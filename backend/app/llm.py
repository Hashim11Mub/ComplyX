"""
Claude Sonnet 4.6 integration for compliance analysis and regulatory chat.
Uses tool_use for structured output on compliance checks (more reliable than JSON parsing).
"""

import os
import anthropic
from .config import settings
from .models import ComplianceResult, Finding, Requirement, ProductType

MODEL = "claude-sonnet-4-6"

AGENT_STEPS = ["استرجاع الأنظمة", "استخلاص الاشتراطات", "فحص الثغرات", "توليد التقرير"]

DISCLAIMER = "هذا تقرير تحليلي مبني على وثائق ساما المتاحة للعموم ولا يُعدّ رأياً قانونياً نهائياً."

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
                        "req_title": {"type": "string", "description": "Requirement title in Arabic"},
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


def analyze_compliance(
    product_description: str,
    product_type: ProductType,
    retrieved_chunks: list[dict],
) -> ComplianceResult:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    regulatory_context, regulation_names = _build_context(retrieved_chunks)
    names_list = "\n".join(f"- {n}" for n in regulation_names)

    system_prompt = f"""أنت محلل امتثال تنظيمي متخصص في أنظمة هيئة السوق المالية السعودية (ساما) ومعايير الشريعة الإسلامية.

مهمتك: تحليل وصف المنتج المالي المقدم وتقييم مدى امتثاله للمواد التنظيمية المستردة.

قواعد صارمة لا استثناء فيها:
- أنتج نتائج فقط للمواد المرقّمة [1] إلى [{len(retrieved_chunks)}] الموجودة في السياق التنظيمي أدناه
- لا تُضف أي مادة أو نظام من خارج هذا السياق ولو كنت تعرفه
- قيمة req_source يجب أن تكون حرفياً إحدى المصادر التالية فقط:
{names_list}
- استخدم اللغة العربية الفصحى في جميع النصوص
- كن محدداً في التحليل والتوصيات
- نسبة الامتثال: 82-100 = مخاطر منخفضة، 58-81 = مخاطر متوسطة، أقل من 58 = مخاطر عالية"""

    user_message = f"""نوع المنتج: {product_type}

وصف المنتج المالي:
{product_description}

المواد التنظيمية المسترجعة من منظومة أنظمة ساما:
{regulatory_context}

حلل هذا المنتج مقابل المواد التنظيمية المقدمة وقدم تقرير الامتثال."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        temperature=0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        tools=[COMPLIANCE_TOOL],
        tool_choice={"type": "any"},
    )

    # Extract tool_use block
    tool_result = next(
        (block for block in response.content if block.type == "tool_use"),
        None,
    )
    if tool_result is None:
        raise ValueError("Claude did not call the compliance report tool")

    data = tool_result.input
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

    return ComplianceResult(
        product_type=product_type,
        compliance_score=data["compliance_score"],
        risk_level=data["risk_level"],
        gaps_count=data["gaps_count"],
        findings=findings,
        executive_summary=data["executive_summary"],
        agent_steps=AGENT_STEPS,
        disclaimer=DISCLAIMER,
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
