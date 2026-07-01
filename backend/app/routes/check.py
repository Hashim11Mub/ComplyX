from fastapi import APIRouter, HTTPException
from ..models import CheckRequest, ComplianceResult
from ..retriever import search, count_indexed
from ..llm import analyze_compliance

router = APIRouter()


@router.post("/check", response_model=ComplianceResult)
async def check_compliance(body: CheckRequest) -> ComplianceResult:
    if len(body.product_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="وصف المنتج قصير جداً")

    indexed = count_indexed()
    if indexed == 0:
        raise HTTPException(
            status_code=503,
            detail="قاعدة المعرفة التنظيمية غير جاهزة. شغّل سكريبت الاستيعاب أولاً.",
        )

    chunks = search(body.product_description, limit=8)
    if not chunks:
        raise HTTPException(status_code=503, detail="لم يتم العثور على مواد تنظيمية مرتبطة")

    result = analyze_compliance(
        product_description=body.product_description,
        product_type=body.product_type,
        retrieved_chunks=chunks,
    )
    return result
