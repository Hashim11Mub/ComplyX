from fastapi import APIRouter, HTTPException
from ..models import ChatRequest, ChatResponse
from ..retriever import search, count_indexed
from ..llm import answer_regulatory_question

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
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
    )
    return ChatResponse(answer=answer)
