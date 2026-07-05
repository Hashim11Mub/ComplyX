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


class ComplianceResult(BaseModel):
    product_type: ProductType
    compliance_score: int
    risk_level: RiskLevel
    gaps_count: int
    findings: list[Finding]
    executive_summary: str
    agent_steps: list[str]
    disclaimer: str


class CheckRequest(BaseModel):
    product_description: str
    product_type: ProductType
    tone: str = "executive"  # simple | executive | technical
    lang: str = "ar"         # ar | en
    corpora: list[str] | None = None  # e.g. ["sama","pdpl","shariah","cma"]; None = all


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


class ChatRequest(BaseModel):
    query: str
    messages: list[ChatMessage] = []


class ChatResponse(BaseModel):
    answer: str
