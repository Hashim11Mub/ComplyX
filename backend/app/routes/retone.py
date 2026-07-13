from fastapi import APIRouter, HTTPException
from ..models import RetoneRequest, ComplianceResult
from ..llm import retone_findings, AGENT_STEPS_EN, AGENT_STEPS_AR, DISCLAIMER_EN, DISCLAIMER_AR
from ..scoring import score_findings

router = APIRouter()


# Sync def on purpose: blocking LLM call; threadpool keeps /health responsive.
@router.post("/retone", response_model=ComplianceResult)
def retone(body: RetoneRequest) -> ComplianceResult:
    if not body.findings:
        raise HTTPException(status_code=400, detail="No findings to retone")

    findings, executive_summary = retone_findings(
        body.findings, body.tone, body.lang, original_summary=body.executive_summary
    )
    score, risk_level, gaps, breakdown = score_findings(findings)
    lang_key = body.lang if body.lang in ("ar", "en") else "ar"
    return ComplianceResult(
        product_type=body.product_type,
        compliance_score=score,
        risk_level=risk_level,
        gaps_count=gaps,
        findings=findings,
        executive_summary=executive_summary,
        agent_steps=AGENT_STEPS_EN if lang_key == "en" else AGENT_STEPS_AR,
        disclaimer=DISCLAIMER_EN if lang_key == "en" else DISCLAIMER_AR,
        score_breakdown=breakdown,
    )
