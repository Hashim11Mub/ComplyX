from fastapi import APIRouter
from ..models import ClarifyRequest, ClarifyResponse
from ..llm import generate_clarification_questions

router = APIRouter()


# Sync def on purpose: Haiku call blocks ~10s; threadpool keeps /health responsive.
@router.post("/clarify", response_model=ClarifyResponse)
def clarify_product(body: ClarifyRequest) -> ClarifyResponse:
    if len(body.product_description.strip()) < 20:
        return ClarifyResponse(questions=[])
    return generate_clarification_questions(
        product_description=body.product_description,
        product_type=body.product_type,
        lang=body.lang,
    )
