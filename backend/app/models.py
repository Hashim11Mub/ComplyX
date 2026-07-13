from typing import Literal
from pydantic import BaseModel

ProductType = Literal[
    "open_banking", "aml", "consumer_finance", "pdpl", "payment_services", "general"
]

RiskLevel = Literal["low", "medium", "high"]
FindingStatus = Literal["compliant", "gap", "needs_review"]


class Requirement(BaseModel):
    id: str
    source: str
    article: str
    title: str
    text: str
    keywords: list[str]
    regulator: str = ""  # SAMA | SDAIA | AAOIFI | CMA | ""


class Finding(BaseModel):
    requirement: Requirement
    status: FindingStatus
    risk: RiskLevel
    analysis: str
    recommendation: str
    # Set only when the finding's status/risk relies on a detail the user gave
    # in the clarification interview; the UI attributes it ("based on your answer").
    user_answer_ref: str = ""


class GateInfo(BaseModel):
    """A non-compensatory severity gate that capped the score (methodology v3).
    Present in ScoreBreakdown only when it actually lowered the score."""
    kind: Literal["high_gap", "medium_gap"]
    cap: int
    findings: list[int]  # indexes into ComplianceResult.findings that triggered it


class ScoreBreakdown(BaseModel):
    """Full scoring arithmetic so the report can show exactly why a product
    scored what it scored. penalties[] is aligned with findings[] by index."""
    base: int  # always 100
    penalties: list[int]
    subtotal: int  # base minus penalties, clamped, before gates
    gate: GateInfo | None = None
    final: int
    driver: Literal["gaps", "reviews", "mixed", "none"]


class ComplianceResult(BaseModel):
    product_type: ProductType
    compliance_score: int
    risk_level: RiskLevel
    gaps_count: int
    findings: list[Finding]
    executive_summary: str
    agent_steps: list[str]
    disclaimer: str
    score_breakdown: ScoreBreakdown


class CheckRequest(BaseModel):
    product_description: str
    product_type: ProductType
    tone: str = "executive"  # simple | executive | technical
    lang: str = "ar"         # ar | en
    corpora: list[str] | None = None  # e.g. ["sama","pdpl","shariah","cma"]; None = all


class RetoneRequest(BaseModel):
    """Re-render an existing report in a new tone/language without
    re-classifying anything. `findings` carry their original status/risk,
    which are never sent back to the LLM for revision (see llm.retone_findings)."""
    product_type: ProductType
    tone: str = "executive"
    lang: str = "ar"
    findings: list[Finding]
    # Original executive summary: given to the LLM to rewrite (not invent) and
    # used as a fallback if the rewrite omits one, so the summary never vanishes.
    executive_summary: str = ""


class ClarifyOption(BaseModel):
    value: str
    label_en: str
    label_ar: str


class ClarifyQuestion(BaseModel):
    id: str
    text_en: str
    text_ar: str
    allow_multiple: bool = False
    options: list[ClarifyOption]


class ClarifyRequest(BaseModel):
    product_description: str
    product_type: ProductType
    lang: str = "ar"


class ClarifyResponse(BaseModel):
    questions: list[ClarifyQuestion]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatFindingBrief(BaseModel):
    """Compact finding used inside ChatSessionContext (keeps the chat prompt small)."""
    title: str
    status: str
    risk: str
    article: str
    source: str
    regulator: str = ""


class ChatSessionContext(BaseModel):
    """What the assistant knows about the current user session. All optional;
    the frontend sends whatever exists at the moment the question is asked."""
    product_type: str = ""
    product_description: str = ""      # truncated client-side
    uploaded_file_name: str = ""
    clarified_answers: list[str] = []  # "Question: answer" lines from the interview
    compliance_score: int | None = None
    risk_level: str = ""
    gaps_count: int | None = None
    findings: list[ChatFindingBrief] = []
    executive_summary: str = ""
    lang: str = "ar"


class ChatRequest(BaseModel):
    query: str
    messages: list[ChatMessage] = []
    context: ChatSessionContext | None = None


class ChatResponse(BaseModel):
    answer: str
