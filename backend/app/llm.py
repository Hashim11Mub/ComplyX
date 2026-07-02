"""
Claude Sonnet 4.6 integration for compliance analysis and regulatory chat.
Uses tool_use for structured output on compliance checks (more reliable than JSON parsing).
"""

import os
import anthropic
from .config import settings
from .models import (
    ComplianceResult, Finding, Requirement, ProductType,
    ClarifyOption, ClarifyQuestion, ClarifyResponse,
)

# Enable LangSmith tracing when configured
if settings.langchain_tracing_v2 and settings.langchain_api_key:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_API_KEY", settings.langchain_api_key)
    os.environ.setdefault("LANGCHAIN_PROJECT", settings.langchain_project)

try:
    from langsmith import traceable as _traceable
    _LANGSMITH_AVAILABLE = True
except ImportError:
    _LANGSMITH_AVAILABLE = False
    def _traceable(name=None, **kwargs):  # type: ignore[misc]
        def decorator(fn):
            return fn
        return decorator

MODEL = "claude-sonnet-4-6"

AGENT_STEPS_AR = [
    "استخراج نطاق المنتج",
    "البحث في قاعدة اللوائح",
    "تحليل متطلبات الامتثال",
    "إعداد تقرير النتائج",
]
AGENT_STEPS_EN = [
    "Extracting product scope",
    "Searching regulation database",
    "Analysing compliance requirements",
    "Compiling findings report",
]

DISCLAIMER_AR = "هذا تقرير تحليلي مبني على وثائق تنظيمية متاحة للعموم ولا يُعدّ رأياً قانونياً نهائياً."
DISCLAIMER_EN = "This is an analytical report based on publicly available regulatory documents and does not constitute final legal advice."

_TONE_INSTRUCTION = {
    "simple": {
        "ar": "اكتب التحليلات والتوصيات بلغة مبسطة تناسب القارئ غير المتخصص، بجمل قصيرة وواضحة.",
        "en": "Write analyses and recommendations in plain language suitable for a non-specialist reader, using short clear sentences.",
    },
    "executive": {
        "ar": "اكتب التحليلات والتوصيات بأسلوب تنفيذي يركز على الأثر التجاري والقرارات المطلوبة.",
        "en": "Write analyses and recommendations in an executive style focused on business impact and required decisions.",
    },
    "technical": {
        "ar": "اكتب التحليلات والتوصيات بأسلوب تقني مفصل يتضمن المرجع التنظيمي الدقيق والإجراءات المحددة.",
        "en": "Write analyses and recommendations in detailed technical style including precise regulatory references and specific procedures.",
    },
}

COMPLIANCE_TOOL = {
    "name": "submit_compliance_report",
    "description": "Submit the structured compliance analysis report for the financial product",
    "input_schema": {
        "type": "object",
        "required": ["compliance_score", "risk_level", "gaps_count", "findings", "executive_summary"],
        "properties": {
            "compliance_score": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": "Overall compliance percentage (0-100)",
            },
            "risk_level": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "low if score>=82, medium if 58-81, high if <58",
            },
            "gaps_count": {"type": "integer", "description": "Number of gap findings"},
            "executive_summary": {
                "type": "string",
                "description": "2-3 sentence Arabic executive summary of the compliance analysis",
            },
            "findings": {
                "type": "array",
                "description": "One finding per regulatory requirement identified",
                "items": {
                    "type": "object",
                    "required": [
                        "req_id", "req_source", "req_article", "req_title",
                        "req_text", "req_keywords", "status", "risk", "analysis", "recommendation",
                    ],
                    "properties": {
                        "req_id": {"type": "string", "description": "Unique slug e.g. 'consumer-finance-disclosure'"},
                        "req_source": {"type": "string", "description": "Exact regulation name as it appears in the context — must match one of the provided source names verbatim"},
                        "req_article": {"type": "string", "description": "Article number/name exactly as shown in the context (e.g. 'القاعدة 17' or 'المادة 33')"},
                        "req_title": {"type": "string", "description": "Requirement title — in Arabic when responding in Arabic, translated to English when responding in English"},
                        "req_text": {"type": "string", "description": "Exact article text from the regulation"},
                        "req_keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "2-4 Arabic keywords from the article",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["compliant", "gap", "needs_review"],
                            "description": "compliant=product clearly addresses this, gap=missing, needs_review=unclear",
                        },
                        "risk": {"type": "string", "enum": ["low", "medium", "high"]},
                        "analysis": {
                            "type": "string",
                            "description": "Arabic analysis of how the product relates to this requirement",
                        },
                        "recommendation": {
                            "type": "string",
                            "description": "Arabic actionable recommendation",
                        },
                    },
                },
            },
        },
    },
}


CLARIFY_TOOL = {
    "name": "return_clarification_questions",
    "description": "Return targeted clarification questions for missing compliance-critical details",
    "input_schema": {
        "type": "object",
        "required": ["questions"],
        "properties": {
            "questions": {
                "type": "array",
                "description": "0-4 targeted questions. Empty array if description is already comprehensive.",
                "items": {
                    "type": "object",
                    "required": ["id", "text_en", "text_ar", "allow_multiple", "options"],
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "Short kebab-case slug e.g. 'license-status'",
                        },
                        "text_en": {"type": "string", "description": "Question in English"},
                        "text_ar": {"type": "string", "description": "Question in Arabic"},
                        "allow_multiple": {
                            "type": "boolean",
                            "description": "True if the user may select multiple answers",
                        },
                        "options": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "required": ["value", "label_en", "label_ar"],
                                "properties": {
                                    "value": {
                                        "type": "string",
                                        "description": "Machine-readable slug",
                                    },
                                    "label_en": {"type": "string"},
                                    "label_ar": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            }
        },
    },
}


@_traceable(name="generate_clarification_questions")
def generate_clarification_questions(
    product_description: str,
    product_type: ProductType,
    lang: str = "ar",
) -> ClarifyResponse:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    system_prompt = (
        "You are a SAMA (Saudi Central Bank) compliance intake specialist.\n"
        "Given a financial product description, identify the 0-4 most critical missing details "
        "needed for an accurate SAMA compliance assessment.\n\n"
        "Compliance-critical dimensions to check (only ask if genuinely missing or ambiguous):\n"
        "1. License status — operating under existing SAMA/SOCPA license, applying, or pre-application?\n"
        "2. Target users — Saudi nationals, residents, SMEs, retail consumers, or combinations?\n"
        "3. Transaction limits — daily/monthly volumes and per-transaction caps\n"
        "4. Data handling — personal/financial data collected, stored, processed\n"
        "5. Third-party integrations — Saudi banks, SADAD, SARIE, international networks\n"
        "6. Authentication method — OTP, biometric, multi-factor, password only\n"
        "7. Credit/lending component — any credit extension, BNPL, or interest-bearing element\n\n"
        "Rules:\n"
        "- Return 0 questions if the description already addresses the relevant dimensions\n"
        "- Maximum 4 questions total\n"
        "- Each question must have 2-4 crisp, distinct options\n"
        "- Do NOT ask about things already stated in the description\n"
        "- Provide every question and option label in both Arabic and English"
    )

    user_message = (
        f"Product type: {product_type}\n\n"
        f"Product description:\n{product_description}\n\n"
        "Identify the missing compliance-critical details and return targeted questions."
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        temperature=0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        tools=[CLARIFY_TOOL],
        tool_choice={"type": "any"},
    )

    tool_result = next(
        (block for block in response.content if block.type == "tool_use"),
        None,
    )
    if tool_result is None:
        return ClarifyResponse(questions=[])

    data = tool_result.input
    questions = []
    for q in data.get("questions", []):
        options = [
            ClarifyOption(
                value=o["value"],
                label_en=o["label_en"],
                label_ar=o["label_ar"],
            )
            for o in q.get("options", [])
        ]
        questions.append(
            ClarifyQuestion(
                id=q["id"],
                text_en=q["text_en"],
                text_ar=q["text_ar"],
                allow_multiple=q.get("allow_multiple", False),
                options=options,
            )
        )

    return ClarifyResponse(questions=questions)


def _build_context(chunks: list[dict]) -> tuple[str, list[str]]:
    parts = []
    regulation_names = []
    for i, chunk in enumerate(chunks, 1):
        name = chunk["regulation_name"]
        parts.append(
            f"[{i}] {name} — {chunk['article_number']}\n"
            f"{chunk.get('article_title', '')}\n"
            f"{chunk['text'][:800]}"
        )
        if name not in regulation_names:
            regulation_names.append(name)
    return "\n\n---\n\n".join(parts), regulation_names


@_traceable(name="analyze_compliance")
def analyze_compliance(
    product_description: str,
    product_type: ProductType,
    retrieved_chunks: list[dict],
    tone: str = "executive",
    lang: str = "ar",
) -> ComplianceResult:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    regulatory_context, regulation_names = _build_context(retrieved_chunks)
    names_list = "\n".join(f"- {n}" for n in regulation_names)

    tone_key = tone if tone in _TONE_INSTRUCTION else "executive"
    lang_key = lang if lang in ("ar", "en") else "ar"
    tone_instruction = _TONE_INSTRUCTION[tone_key][lang_key]

    if lang_key == "en":
        system_prompt = f"""You are a regulatory compliance analyst specialising in Saudi Arabian financial regulations and Islamic finance standards.

Your task: analyse the submitted financial product description and assess its compliance against the retrieved regulatory articles.

Strict rules — no exceptions:
- Only produce findings for articles numbered [1] to [{len(retrieved_chunks)}] present in the regulatory context below
- Do not add any article or regulation from outside this context, even if you know it
- req_source must be verbatim one of these sources only:
{names_list}
- {tone_instruction}
- Compliance score: 82-100 = low risk, 58-81 = medium risk, below 58 = high risk
- Write req_title in English (translate from the Arabic regulation title)
- Write req_text in Arabic as it appears verbatim in the regulation
- Write analysis and recommendation in English"""
    else:
        system_prompt = f"""أنت محلل امتثال تنظيمي متخصص في الأنظمة المالية السعودية ومعايير التمويل الإسلامي.

مهمتك: تحليل وصف المنتج المالي المقدم وتقييم مدى امتثاله للمواد التنظيمية المستردة.

قواعد صارمة لا استثناء فيها:
- أنتج نتائج فقط للمواد المرقّمة [1] إلى [{len(retrieved_chunks)}] الموجودة في السياق التنظيمي أدناه
- لا تُضف أي مادة أو نظام من خارج هذا السياق ولو كنت تعرفه
- قيمة req_source يجب أن تكون حرفياً إحدى المصادر التالية فقط:
{names_list}
- {tone_instruction}
- كن محدداً في التحليل والتوصيات
- نسبة الامتثال: 82-100 = مخاطر منخفضة، 58-81 = مخاطر متوسطة، أقل من 58 = مخاطر عالية"""

    if lang_key == "en":
        user_message = f"""Product type: {product_type}

Financial product description:
{product_description}

Retrieved regulatory articles:
{regulatory_context}

Analyse this product against the regulatory articles provided and submit the compliance report."""
    else:
        user_message = f"""نوع المنتج: {product_type}

وصف المنتج المالي:
{product_description}

المواد التنظيمية المسترجعة:
{regulatory_context}

حلل هذا المنتج مقابل المواد التنظيمية المقدمة وقدم تقرير الامتثال."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        temperature=0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        tools=[COMPLIANCE_TOOL],
        tool_choice={"type": "any"},
    )

    tool_result = next(
        (block for block in response.content if block.type == "tool_use"),
        None,
    )
    if tool_result is None:
        raise ValueError("Claude did not call the compliance report tool")

    data = tool_result.input
    if "findings" not in data:
        import json as _json
        raise ValueError(
            f"Tool response missing 'findings'. Stop reason: {response.stop_reason}. "
            f"Keys present: {list(data.keys())}. "
            f"Partial data: {_json.dumps(data, ensure_ascii=False)[:600]}"
        )
    findings = [
        Finding(
            requirement=Requirement(
                id=f["req_id"],
                source=f["req_source"],
                article=f["req_article"],
                title=f["req_title"],
                text=f["req_text"],
                keywords=f["req_keywords"],
            ),
            status=f["status"],
            risk=f["risk"],
            analysis=f["analysis"],
            recommendation=f["recommendation"],
        )
        for f in data["findings"]
    ]

    agent_steps = AGENT_STEPS_EN if lang_key == "en" else AGENT_STEPS_AR
    disclaimer = DISCLAIMER_EN if lang_key == "en" else DISCLAIMER_AR

    return ComplianceResult(
        product_type=product_type,
        compliance_score=data["compliance_score"],
        risk_level=data["risk_level"],
        gaps_count=data["gaps_count"],
        findings=findings,
        executive_summary=data["executive_summary"],
        agent_steps=agent_steps,
        disclaimer=disclaimer,
    )


def answer_regulatory_question(
    query: str,
    retrieved_chunks: list[dict],
    history: list[dict],
) -> str:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    regulatory_context, _ = _build_context(retrieved_chunks)

    system_prompt = f"""أنت مستشار تنظيمي متخصص في أنظمة ساما والتشريعات المالية السعودية.
أجب على الأسئلة التنظيمية بدقة، مستنداً إلى المواد التنظيمية المقدمة.
اذكر رقم المادة والنظام المصدر عند كل استشهاد.
استخدم اللغة العربية الفصحى.

السياق التنظيمي:
{regulatory_context}"""

    messages = [
        *[{"role": m["role"], "content": m["content"]} for m in history[:-1]],
        {"role": "user", "content": query},
    ]

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text
