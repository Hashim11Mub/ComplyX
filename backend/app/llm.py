"""
Claude integration for compliance analysis, clarification and regulatory chat.

Key design decisions (see agent/AUDIT-2026-07-03.md):
- A-1: the LLM never reproduces regulation text. It returns the index of the
  retrieved chunk each finding is based on; the backend attaches the true
  verbatim text/source/article from that chunk. Quote and source faithfulness
  are 1.0 by construction, and the output schema is ~40% smaller (latency).
- I-5: the LLM does not produce a score. scoring.score_findings() derives it
  deterministically from finding statuses and risks.
- A-4: static system prompt + tools carry cache_control; the large retrieved
  context carries a second breakpoint so tone/language re-fetches of the same
  product hit the prompt cache. Clarification runs on Haiku (fast, cheap).
- F-1: analyze_compliance_stream() streams findings incrementally using
  fine-grained tool streaming (eager_input_streaming).
"""

import json
import os
from typing import Any, Generator

import anthropic

from .config import settings
from .models import (
    ComplianceResult, Finding, Requirement, ProductType,
    ClarifyOption, ClarifyQuestion, ClarifyResponse,
)
from .scoring import score_findings
from .textclean import clean_excerpt

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
CLARIFY_MODEL = "claude-haiku-4-5"

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

# ── Compliance tool (v2 — slim, chunk-index based) ──────────────────────────
# The LLM references retrieved articles by index; it never writes regulation
# text, source names, article numbers, or scores. The backend fills those in.

COMPLIANCE_TOOL: dict[str, Any] = {
    "name": "submit_compliance_report",
    "description": "Submit the structured compliance analysis for the financial product",
    "eager_input_streaming": True,
    "input_schema": {
        "type": "object",
        "required": ["findings", "executive_summary"],
        "properties": {
            "findings": {
                "type": "array",
                "maxItems": 8,
                "description": "One finding per relevant regulatory requirement, most decision-critical first. Do not force findings for irrelevant articles.",
                "items": {
                    "type": "object",
                    "required": ["chunk", "title", "keywords", "status", "risk", "analysis", "recommendation"],
                    "properties": {
                        "chunk": {
                            "type": "integer",
                            "description": "Index of the retrieved regulatory article this finding is based on — must be one of the [n] numbers in the provided context",
                        },
                        "title": {
                            "type": "string",
                            "description": "Short requirement title, written in the response language",
                        },
                        "keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "2-4 keywords in the response language",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["compliant", "gap", "needs_review"],
                            "description": "compliant=product clearly addresses this, gap=missing/violated, needs_review=cannot be determined from the description",
                        },
                        "risk": {"type": "string", "enum": ["low", "medium", "high"]},
                        "analysis": {
                            "type": "string",
                            "description": "How the product relates to this requirement, in the response language",
                        },
                        "recommendation": {
                            "type": "string",
                            "description": "Actionable recommendation, in the response language",
                        },
                        "user_answer_ref": {
                            "type": "string",
                            "description": "ONLY if this finding's status or risk relies on a detail from the '[Additional details provided by user]' section of the description: copy that short detail here verbatim. Omit for findings based on the main description.",
                        },
                    },
                },
            },
            "executive_summary": {
                "type": "string",
                "description": "2-3 sentence executive summary in the response language",
            },
        },
    },
}

# Static system prompt — deliberately free of any per-request interpolation so
# the tools+system prefix is byte-identical across every scan (prompt cache).
COMPLIANCE_SYSTEM = """You are a regulatory compliance analyst specialising in Saudi Arabian financial regulation: SAMA rulebooks, the Personal Data Protection Law (SDAIA), AAOIFI Shariah standards, and Capital Market Authority regulations.

Task: assess the submitted financial product description against ONLY the numbered regulatory articles provided in the user message.

Strict rules — no exceptions:
- Every finding references exactly one provided article via its index in the `chunk` field. Never cite regulations from memory; if a requirement you know of is not in the provided articles, do not mention it.
- Return at most 8 findings. Pick the articles most material to this product; skip irrelevant ones.
- status: compliant = the description explicitly addresses the requirement; gap = the requirement clearly applies and is not met; needs_review = applicability or coverage cannot be determined from the description.
- risk reflects the severity of THIS requirement for THIS product.
- Write executive_summary, title, keywords, analysis and recommendation in the response language and tone requested at the end of the user message. This applies to `title` especially: when the response language is Arabic, every finding title MUST be written in Arabic even though the source articles are in English. Never copy an English article heading as a title in an Arabic report.
- The description may end with a section labelled [Additional details provided by user] (Arabic: [تفاصيل إضافية يقدمها المستخدم]) containing answers the user gave in a clarification interview. Treat those answers as facts about the product. When a finding's status or risk is materially based on one of those answers, copy that answer into the finding's user_answer_ref field so the report can attribute it to the user; leave user_answer_ref out otherwise.
- Never use the em dash character (—) in any text you write; use a comma, colon or period instead.
- Do not calculate an overall score. The system derives it from your findings."""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


# ── Clarification (Haiku — fast structured intake) ──────────────────────────

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
                        "id": {"type": "string", "description": "Short kebab-case slug e.g. 'license-status'"},
                        "text_en": {"type": "string", "description": "Question in English"},
                        "text_ar": {"type": "string", "description": "Question in Arabic"},
                        "allow_multiple": {"type": "boolean", "description": "True if the user may select multiple answers"},
                        "options": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "required": ["value", "label_en", "label_ar"],
                                "properties": {
                                    "value": {"type": "string", "description": "Machine-readable slug"},
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

CLARIFY_SYSTEM = (
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


@_traceable(name="generate_clarification_questions")
def generate_clarification_questions(
    product_description: str,
    product_type: ProductType,
    lang: str = "ar",
) -> ClarifyResponse:
    response = _client().messages.create(
        model=CLARIFY_MODEL,
        max_tokens=1500,
        temperature=0,
        system=[{"type": "text", "text": CLARIFY_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": (
                f"Product type: {product_type}\n\n"
                f"Product description:\n{product_description}\n\n"
                "Identify the missing compliance-critical details and return targeted questions."
            ),
        }],
        tools=[CLARIFY_TOOL],
        tool_choice={"type": "any"},
    )

    tool_result = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_result is None:
        return ClarifyResponse(questions=[])

    questions = []
    for q in tool_result.input.get("questions", []):
        options = [
            ClarifyOption(value=o["value"], label_en=o["label_en"], label_ar=o["label_ar"])
            for o in q.get("options", [])
        ]
        questions.append(ClarifyQuestion(
            id=q["id"],
            text_en=q["text_en"],
            text_ar=q["text_ar"],
            allow_multiple=q.get("allow_multiple", False),
            options=options,
        ))
    return ClarifyResponse(questions=questions)


# ── Compliance analysis ──────────────────────────────────────────────────────

def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(
            f"[{i}] {chunk['regulation_name']} — {chunk['article_number']}"
            f" ({chunk.get('regulator', '') or 'SAMA'})\n"
            f"{chunk.get('article_title', '')}\n"
            f"{chunk['text'][:800]}"
        )
    return "\n\n---\n\n".join(parts)


def _build_messages(
    product_description: str,
    product_type: ProductType,
    chunks: list[dict],
    tone: str,
    lang: str,
) -> list[dict]:
    tone_key = tone if tone in _TONE_INSTRUCTION else "executive"
    lang_key = lang if lang in ("ar", "en") else "ar"
    lang_name = "English" if lang_key == "en" else "Arabic (اللغة العربية الفصحى)"

    # Block 1 (cached across re-fetches): product + retrieved context.
    # Block 2 (volatile): response language + tone — the only part that
    # changes when the user flips language or detail level.
    context_block = (
        f"Product type: {product_type}\n\n"
        f"Financial product description:\n{product_description}\n\n"
        f"Retrieved regulatory articles:\n{_build_context(chunks)}"
    )
    instruction_block = (
        f"Response language: {lang_name}.\n"
        f"Tone: {_TONE_INSTRUCTION[tone_key][lang_key]}\n"
        "Analyse the product against the provided articles and submit the compliance report."
    )
    return [{
        "role": "user",
        "content": [
            {"type": "text", "text": context_block, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": instruction_block},
        ],
    }]


def _finding_from_tool(item: dict, chunks: list[dict], position: int) -> Finding | None:
    """Build a Finding, injecting verbatim text/source/article from the chunk."""
    chunk_idx = item.get("chunk")
    if not isinstance(chunk_idx, int) or not (1 <= chunk_idx <= len(chunks)):
        return None
    chunk = chunks[chunk_idx - 1]
    corpus = chunk.get("corpus", "") or "reg"
    return Finding(
        requirement=Requirement(
            id=f"{corpus}-c{chunk_idx}-{position}",
            source=chunk.get("regulation_name", ""),
            article=chunk.get("article_number", ""),
            title=item.get("title", ""),
            # Trim windowed-chunk edges to sentence boundaries; the cleaner
            # only removes from the ends, so the stored quote stays a verbatim
            # substring of the retrieved chunk (faithfulness by construction).
            text=clean_excerpt(chunk.get("text", ""), 1200),
            keywords=item.get("keywords", []) or [],
            regulator=chunk.get("regulator", ""),
        ),
        status=item.get("status", "needs_review"),
        risk=item.get("risk", "medium"),
        analysis=item.get("analysis", ""),
        recommendation=item.get("recommendation", ""),
        user_answer_ref=str(item.get("user_answer_ref") or ""),
    )


def _assemble_result(
    data: dict,
    chunks: list[dict],
    product_type: ProductType,
    lang: str,
) -> ComplianceResult:
    findings: list[Finding] = []
    for i, item in enumerate(data.get("findings", []), 1):
        finding = _finding_from_tool(item, chunks, i)
        if finding is not None:
            findings.append(finding)

    score, risk_level, gaps = score_findings(findings)
    lang_key = lang if lang in ("ar", "en") else "ar"
    return ComplianceResult(
        product_type=product_type,
        compliance_score=score,
        risk_level=risk_level,
        gaps_count=gaps,
        findings=findings,
        executive_summary=data.get("executive_summary", ""),
        agent_steps=AGENT_STEPS_EN if lang_key == "en" else AGENT_STEPS_AR,
        disclaimer=DISCLAIMER_EN if lang_key == "en" else DISCLAIMER_AR,
    )


@_traceable(name="analyze_compliance")
def analyze_compliance(
    product_description: str,
    product_type: ProductType,
    retrieved_chunks: list[dict],
    tone: str = "executive",
    lang: str = "ar",
) -> ComplianceResult:
    response = _client().messages.create(
        model=MODEL,
        max_tokens=4096,
        temperature=0,
        system=[{"type": "text", "text": COMPLIANCE_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=_build_messages(product_description, product_type, retrieved_chunks, tone, lang),
        tools=[COMPLIANCE_TOOL],
        tool_choice={"type": "any"},
    )

    tool_result = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_result is None:
        raise ValueError("Claude did not call the compliance report tool")

    data = tool_result.input
    if "findings" not in data:
        raise ValueError(
            f"Tool response missing 'findings'. Stop reason: {response.stop_reason}. "
            f"Keys present: {list(data.keys())}. "
            f"Partial data: {json.dumps(data, ensure_ascii=False)[:600]}"
        )
    return _assemble_result(data, retrieved_chunks, product_type, lang)


# ── Streaming variant (F-1) ──────────────────────────────────────────────────

class _FindingsScanner:
    """Incrementally extract completed objects from the `findings` array of a
    partially received tool-input JSON string."""

    def __init__(self) -> None:
        self.buf = ""
        self.array_start = -1  # offset of '[' of the findings array
        self.pos = -1          # scan offset within buf
        self.depth = 0
        self.in_string = False
        self.escape = False
        self.obj_start = -1

    def feed(self, fragment: str) -> list[dict]:
        self.buf += fragment
        if self.array_start < 0:
            key = self.buf.find('"findings"')
            if key < 0:
                return []
            bracket = self.buf.find("[", key)
            if bracket < 0:
                return []
            self.array_start = bracket
            self.pos = bracket + 1

        out: list[dict] = []
        while self.pos < len(self.buf):
            ch = self.buf[self.pos]
            if self.in_string:
                if self.escape:
                    self.escape = False
                elif ch == "\\":
                    self.escape = True
                elif ch == '"':
                    self.in_string = False
            elif ch == '"':
                self.in_string = True
            elif ch == "{":
                if self.depth == 0:
                    self.obj_start = self.pos
                self.depth += 1
            elif ch == "}":
                self.depth -= 1
                if self.depth == 0 and self.obj_start >= 0:
                    try:
                        out.append(json.loads(self.buf[self.obj_start : self.pos + 1]))
                    except json.JSONDecodeError:
                        pass
                    self.obj_start = -1
            elif ch == "]" and self.depth == 0:
                break  # findings array closed
            self.pos += 1
        return out


@_traceable(name="analyze_compliance_stream")
def analyze_compliance_stream(
    product_description: str,
    product_type: ProductType,
    retrieved_chunks: list[dict],
    tone: str = "executive",
    lang: str = "ar",
) -> Generator[tuple[str, Any], None, None]:
    """Yield ("finding", Finding) events as Claude writes them, then a final
    ("complete", ComplianceResult) assembled from the full tool input."""
    scanner = _FindingsScanner()
    emitted = 0

    with _client().messages.stream(
        model=MODEL,
        max_tokens=4096,
        temperature=0,
        system=[{"type": "text", "text": COMPLIANCE_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=_build_messages(product_description, product_type, retrieved_chunks, tone, lang),
        tools=[COMPLIANCE_TOOL],
        tool_choice={"type": "any"},
    ) as stream:
        for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "input_json_delta":
                for item in scanner.feed(event.delta.partial_json):
                    finding = _finding_from_tool(item, retrieved_chunks, emitted + 1)
                    if finding is not None:
                        emitted += 1
                        yield ("finding", finding)
        final = stream.get_final_message()

    tool_result = next((b for b in final.content if b.type == "tool_use"), None)
    if tool_result is None:
        raise ValueError("Claude did not call the compliance report tool")
    yield ("complete", _assemble_result(tool_result.input, retrieved_chunks, product_type, lang))


# ── Report retone (tone/language re-render, no reclassification) ────────────
# A tone or language switch must never move the score. score_findings() derives
# the score purely from finding.status/finding.risk (scoring.py), so this path
# never lets the LLM touch either field: the tool schema below has no
# status/risk properties at all, and _assemble step below copies them verbatim
# from the original findings. The score is therefore identical by construction,
# not merely "usually stable".

RETONE_TOOL: dict[str, Any] = {
    "name": "submit_retoned_report",
    "description": "Rewrite the presentation text of an already-classified compliance report in a new tone/language",
    "input_schema": {
        "type": "object",
        "required": ["findings", "executive_summary"],
        "properties": {
            "findings": {
                "type": "array",
                "description": "Exactly one entry per input finding, in the same order — do not add, remove, merge or reorder.",
                "items": {
                    "type": "object",
                    "required": ["title", "keywords", "analysis", "recommendation"],
                    "properties": {
                        "title": {"type": "string", "description": "Short requirement title, in the response language"},
                        "keywords": {"type": "array", "items": {"type": "string"}, "description": "2-4 keywords in the response language"},
                        "analysis": {"type": "string", "description": "How the product relates to this requirement, in the response language"},
                        "recommendation": {"type": "string", "description": "Actionable recommendation, in the response language"},
                    },
                },
            },
            "executive_summary": {"type": "string", "description": "2-3 sentence executive summary in the response language"},
        },
    },
}

RETONE_SYSTEM = """You rewrite an already-completed SAMA/SDAIA/AAOIFI/CMA compliance report in a new language and/or tone.

Strict rules — no exceptions:
- Each finding's status (compliant/gap/needs_review) and risk level are ALREADY DECIDED and given to you as fixed facts, purely for context. You do not output them and must not imply a different classification in the text you write.
- Return exactly one output finding per input finding, in the same order — do not add, remove, merge or reorder findings.
- Never use the em dash character (—) in any text you write; use a comma, colon or period instead.
- Write title, keywords, analysis, recommendation and executive_summary in the response language and tone requested at the end of the user message."""


def _build_retone_messages(findings: list[Finding], tone: str, lang: str, original_summary: str = "") -> list[dict]:
    tone_key = tone if tone in _TONE_INSTRUCTION else "executive"
    lang_key = lang if lang in ("ar", "en") else "ar"
    lang_name = "English" if lang_key == "en" else "Arabic (اللغة العربية الفصحى)"

    parts = []
    for i, f in enumerate(findings, 1):
        parts.append(
            f"[{i}] Regulation: {f.requirement.source} — {f.requirement.article} ({f.requirement.regulator or 'SAMA'})\n"
            f"Article text: {f.requirement.text[:800]}\n"
            f"Status: {f.status} | Risk: {f.risk} (fixed — for context only, do not restate as a field)\n"
            f"Current title: {f.requirement.title}\n"
            f"Current analysis: {f.analysis}\n"
            f"Current recommendation: {f.recommendation}"
        )
    context_block = "Existing findings to rewrite:\n\n" + "\n\n---\n\n".join(parts)
    if original_summary:
        context_block += f"\n\n---\n\nCurrent executive summary (rewrite this, do not invent a new assessment):\n{original_summary}"
    instruction_block = (
        f"Response language: {lang_name}.\n"
        f"Tone: {_TONE_INSTRUCTION[tone_key][lang_key]}\n"
        "Rewrite each finding's title, keywords, analysis and recommendation, and rewrite the executive summary, "
        "in the requested language and tone. Keep every finding consistent with its given (fixed) status and risk."
    )
    return [{
        "role": "user",
        "content": [
            {"type": "text", "text": context_block},
            {"type": "text", "text": instruction_block},
        ],
    }]


@_traceable(name="retone_findings")
def retone_findings(findings: list[Finding], tone: str = "executive", lang: str = "ar", original_summary: str = "") -> tuple[list[Finding], str]:
    response = _client().messages.create(
        model=MODEL,
        max_tokens=4096,
        temperature=0,
        system=[{"type": "text", "text": RETONE_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=_build_retone_messages(findings, tone, lang, original_summary),
        tools=[RETONE_TOOL],
        tool_choice={"type": "any"},
    )

    tool_result = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_result is None:
        raise ValueError("Claude did not call the retone tool")

    items = tool_result.input.get("findings", [])
    if len(items) != len(findings):
        raise ValueError(f"Retone returned {len(items)} findings for {len(findings)} inputs")

    rewritten: list[Finding] = []
    for original, item in zip(findings, items):
        rewritten.append(Finding(
            requirement=Requirement(
                id=original.requirement.id,
                source=original.requirement.source,
                article=original.requirement.article,
                title=item.get("title", original.requirement.title),
                text=original.requirement.text,
                keywords=item.get("keywords") or original.requirement.keywords,
                regulator=original.requirement.regulator,
            ),
            status=original.status,      # never taken from the LLM — see module docstring
            risk=original.risk,           # never taken from the LLM — see module docstring
            analysis=item.get("analysis", original.analysis),
            recommendation=item.get("recommendation", original.recommendation),
            user_answer_ref=original.user_answer_ref,
        ))
    # Fall back to the original summary rather than returning an empty one:
    # a language switch must never make the executive summary disappear.
    return rewritten, tool_result.input.get("executive_summary", "") or original_summary


# ── Retrieved-title translation (analysis-step slots, Arabic UI) ────────────
# The corpus is English, so retrieved article titles arrive in English. For an
# Arabic session the stream emits the English titles instantly (first paint),
# then a `retrieved_ar` event swaps in these translations when ready. Haiku
# keeps this ~1-2s; any failure is silently skipped (English titles remain).

_TRANSLATE_TITLES_TOOL = {
    "name": "return_arabic_titles",
    "description": "Return the Arabic translations of the given regulatory article titles",
    "input_schema": {
        "type": "object",
        "required": ["titles"],
        "properties": {
            "titles": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Arabic translations, same count and order as the input titles",
            }
        },
    },
}


def translate_titles_ar(titles: list[str]) -> list[str] | None:
    """Translate article titles to Arabic. Returns None on any failure or
    count mismatch so callers can keep the English originals."""
    if not titles:
        return None
    try:
        numbered = "\n".join(f"{i}. {t}" for i, t in enumerate(titles, 1))
        response = _client().messages.create(
            model=CLARIFY_MODEL,
            max_tokens=1500,
            temperature=0,
            system="You translate Saudi financial-regulation article titles from English to Arabic. Translate faithfully and concisely; keep regulator names (SAMA, CMA) as-is. Never use the em dash character (—).",
            messages=[{"role": "user", "content": f"Translate these article titles to Arabic:\n{numbered}"}],
            tools=[_TRANSLATE_TITLES_TOOL],
            tool_choice={"type": "any"},
        )
        tool_result = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_result is None:
            return None
        out = [str(t) for t in tool_result.input.get("titles", [])]
        return out if len(out) == len(titles) else None
    except Exception:
        return None


# ── Regulatory chat ──────────────────────────────────────────────────────────

def answer_regulatory_question(
    query: str,
    retrieved_chunks: list[dict],
    history: list[dict],
    session_context: str = "",
) -> str:
    regulatory_context = _build_context(retrieved_chunks)

    session_block = ""
    if session_context:
        session_block = f"""

سياق جلسة المستخدم الحالية (استخدمه لفهم أسئلة مثل "لماذا هذه النتيجة؟" أو "منتجي هذا"؛ لا تكرره على المستخدم بلا داعٍ):
{session_context}
عند سؤال المستخدم عن نتيجة أو درجة من تقريره، اربط إجابتك بهذه النتائج مباشرة."""

    system_prompt = f"""أنت مستشار تنظيمي متخصص في أنظمة ساما والتشريعات المالية السعودية.
أجب على الأسئلة التنظيمية بدقة، مستنداً إلى المواد التنظيمية المقدمة فقط.
اذكر رقم المادة والنظام المصدر عند كل استشهاد.
أجب بلغة السؤال: إن سُئلت بالعربية فأجب بالعربية الفصحى، وإن سُئلت بالإنجليزية فأجب بالإنجليزية.

قواعد التنسيق (صارمة):
- نص عادي فقط: لا عناوين ماركداون (#)، لا نجوم (**)، لا رموز تعبيرية، لا جداول، لا فواصل أفقية
- لا تستخدم الشرطة الطويلة (—) إطلاقاً؛ استخدم الفاصلة أو النقطتين بدلاً منها
- أجب في فقرة إلى ثلاث فقرات قصيرة كحد أقصى
- إن لم تجد الإجابة في المواد المقدمة فقل ذلك صراحة ولا تخترع مادة

السياق التنظيمي:
{regulatory_context}{session_block}"""

    messages = [
        *[{"role": m["role"], "content": m["content"]} for m in history[:-1]],
        {"role": "user", "content": query},
    ]

    response = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text
