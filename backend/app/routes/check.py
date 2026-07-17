from fastapi import APIRouter, HTTPException
from ..models import CheckRequest, ComplianceResult
from ..retriever import search, count_indexed
from ..llm import analyze_compliance

router = APIRouter()


# Sync def on purpose: retrieval + the LLM call block for up to a minute;
# FastAPI runs sync endpoints in a threadpool so /health stays responsive
# (async def here froze the event loop and made the UI report "Backend offline").
@router.post("/check", response_model=ComplianceResult)
def check_compliance(body: CheckRequest) -> ComplianceResult:
    if len(body.product_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="وصف المنتج قصير جداً")

    indexed = count_indexed()
    if indexed == 0:
        raise HTTPException(
            status_code=503,
            detail="قاعدة المعرفة التنظيمية غير جاهزة. شغّل سكريبت الاستيعاب أولاً.",
        )

    chunks = search(body.product_description, limit=12, corpora=body.corpora)
    if not chunks:
        raise HTTPException(status_code=503, detail="لم يتم العثور على مواد تنظيمية مرتبطة")

    try:
        result = analyze_compliance(
            product_description=body.product_description,
            product_type=body.product_type,
            retrieved_chunks=chunks,
            tone=body.tone,
            lang=body.lang,
        )
    except ValueError as exc:
        print(f"[check] analyze_compliance failed: {exc}")
        raise HTTPException(status_code=502, detail="تعذر إكمال التحليل، حاول مرة أخرى") from exc
    return result
