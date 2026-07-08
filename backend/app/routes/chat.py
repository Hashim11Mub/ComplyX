from fastapi import APIRouter, HTTPException
from ..models import ChatRequest, ChatResponse, ChatSessionContext
from ..retriever import search, count_indexed
from ..llm import answer_regulatory_question

router = APIRouter()


def _session_block(ctx: ChatSessionContext) -> str:
    """Render the frontend-supplied session context as a compact prompt block."""
    lines: list[str] = []
    if ctx.product_type:
        lines.append(f"نوع المنتج: {ctx.product_type}")
    if ctx.product_description:
        lines.append(f"وصف المنتج (مقتطف): {ctx.product_description[:600]}")
    if ctx.uploaded_file_name:
        lines.append(f"رفع المستخدم مستنداً باسم: {ctx.uploaded_file_name} (استُخرج نصه ضمن الوصف)")
    if ctx.clarified_answers:
        lines.append("إجابات المستخدم في مقابلة التوضيح:")
        lines.extend(f"- {a}" for a in ctx.clarified_answers[:8])
    if ctx.compliance_score is not None:
        lines.append(
            f"تقرير الفحص: الدرجة {ctx.compliance_score}/100، المخاطر {ctx.risk_level or 'غير محدد'}، الفجوات {ctx.gaps_count if ctx.gaps_count is not None else '؟'}"
        )
    if ctx.executive_summary:
        lines.append(f"الملخص التنفيذي: {ctx.executive_summary[:500]}")
    if ctx.findings:
        lines.append("النتائج:")
        for f in ctx.findings[:8]:
            lines.append(f"- [{f.status}/{f.risk}] {f.title} ({f.source} {f.article})")
    return "\n".join(lines)


# Sync def on purpose: the LLM call blocks; FastAPI runs sync endpoints in a
# threadpool so /health stays responsive while the model is writing.
@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="الاستفسار فارغ")

    if count_indexed() == 0:
        raise HTTPException(
            status_code=503,
            detail="قاعدة المعرفة التنظيمية غير جاهزة.",
        )

    chunks = search(body.query, limit=5)
    history = [{"role": m.role, "content": m.content} for m in body.messages]

    answer = answer_regulatory_question(
        query=body.query,
        retrieved_chunks=chunks,
        history=history,
        session_context=_session_block(body.context) if body.context else "",
    )
    return ChatResponse(answer=answer)
