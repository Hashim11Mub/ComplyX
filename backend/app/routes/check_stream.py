"""
Streaming compliance scan (audit feature F-1).

SSE events, in order:
  retrieved — the articles found by semantic search (fills the UI slots
              with real regulation titles within ~1s of scan start)
  finding   — one per finding, as Claude writes it (fine-grained tool streaming)
  complete  — the full ComplianceResult (same contract as POST /api/check)
  error     — terminal failure; the client falls back to POST /api/check
"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models import CheckRequest
from ..retriever import search, count_indexed
from ..llm import analyze_compliance_stream, translate_titles_ar

router = APIRouter()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/check/stream")
def check_compliance_stream(body: CheckRequest):
    if len(body.product_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="وصف المنتج قصير جداً")
    if count_indexed() == 0:
        raise HTTPException(status_code=503, detail="قاعدة المعرفة التنظيمية غير جاهزة.")

    chunks = search(body.product_description, limit=12, corpora=body.corpora)
    if not chunks:
        raise HTTPException(status_code=503, detail="لم يتم العثور على مواد تنظيمية مرتبطة")

    def generate():
        yield _sse({
            "event": "retrieved",
            "articles": [
                {
                    "source": c.get("regulation_name", ""),
                    "article": c.get("article_number", ""),
                    "title": c.get("article_title", ""),
                    "regulator": c.get("regulator", ""),
                }
                for c in chunks
            ],
        })
        # Arabic UI: swap in translated titles as a follow-up event. English
        # titles paint first (no latency cost); translation adds ~1-2s before
        # the first finding, which itself takes ~15s. Failure keeps English.
        if body.lang == "ar":
            translated = translate_titles_ar([
                c.get("article_title", "") or c.get("regulation_name", "") for c in chunks
            ])
            if translated:
                yield _sse({"event": "retrieved_ar", "titles": translated})
        try:
            for kind, payload in analyze_compliance_stream(
                product_description=body.product_description,
                product_type=body.product_type,
                retrieved_chunks=chunks,
                tone=body.tone,
                lang=body.lang,
            ):
                if kind == "finding":
                    yield _sse({"event": "finding", "finding": payload.model_dump()})
                elif kind == "complete":
                    yield _sse({"event": "complete", "result": payload.model_dump()})
        except Exception as exc:  # surfaced to the client, which falls back to /api/check
            yield _sse({"event": "error", "detail": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
