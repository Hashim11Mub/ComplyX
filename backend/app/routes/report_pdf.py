"""
Compliance report PDF export (audit feature F-2; redesigned 2026-07-08 from
the Claude Design reference docs/Compliance Report.dc.html).

Renders a branded, bilingual (RTL-aware) HTML report and prints it to PDF
with headless Chromium via Playwright. Returns 501 with guidance if
Playwright is missing.

Design language: A4 pages, cover with dark gradient band + score dial +
stat cards, gold editorial accents, status-colored finding cards, gold
attribution bands for interview-derived findings, sign-off boxes in the
roadmap, interview appendix, scope-and-method closing. Cairo is requested
from Google Fonts at render time when online; the system stack (Segoe UI /
Tahoma, both with Arabic coverage) is the offline fallback.
"""

import html
from collections import Counter
from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import settings
from ..models import ComplianceResult
from ..scoring import projected_score
from ..textclean import clean_excerpt

router = APIRouter()

_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}
_STATUS_ORDER = {"gap": 0, "needs_review": 1, "compliant": 2}

_TECH_HINTS = ("تشفير", "مصادقة", "تقنية", "أنظمة", "API", "encrypt", "authentication", "technical", "system", "data")
_LEGAL_HINTS = ("عقد", "اتفاقية", "قانون", "ترخيص", "contract", "agreement", "legal", "licen")


class InterviewQA(BaseModel):
    """One clarification-interview exchange, already localized by the client."""
    question: str
    answer: str


class ReportPdfRequest(BaseModel):
    result: ComplianceResult
    lang: str = "ar"
    product_label: str = ""
    session_ref: str = ""
    # Full interview Q&A for the appendix; findings cite these answers via
    # user_answer_ref, so the appendix closes that reference chain.
    interview: list[InterviewQA] = []


def _owner(text: str, lang: str) -> str:
    lowered = text.lower()
    if any(h.lower() in lowered for h in _TECH_HINTS):
        return "التقنية" if lang == "ar" else "Technology"
    if any(h.lower() in lowered for h in _LEGAL_HINTS):
        return "الشؤون القانونية" if lang == "ar" else "Legal"
    return "الالتزام" if lang == "ar" else "Compliance"


_T = {
    "ar": {
        "dir": "rtl", "brand": "ضامن · ComplyX", "tagline": "تحليل الالتزام التنظيمي",
        "kicker": "تقرير تقييم الالتزام",
        "product_line": "نوع المنتج: {pt} · المملكة العربية السعودية",
        "session_ref": "المرجع الجلسي", "date": "تاريخ الفحص", "corpus": "إصدار قاعدة اللوائح",
        "coverage": "التغطية", "coverage_val": "{n} مادة مفهرسة · ساما، سدايا، أيوفي، هيئة السوق",
        "score_label": "نسبة الامتثال", "out_of": "من 100",
        "score_caption": "تُحسب النسبة بقواعد تقييم حتمية من حالات النتائج وأوزان المخاطر. الدرجة عملية حسابية، وليست حكماً من الذكاء الاصطناعي.",
        "gaps": "الثغرات", "reviews": "بحاجة لمراجعة", "compliants": "متوافق",
        "by_regulator": "النتائج حسب الجهة",
        "risk_chip": {"low": "مخاطر منخفضة", "medium": "مخاطر متوسطة", "high": "مخاطر مرتفعة"},
        "summary": "الملخص التنفيذي",
        "note_label": "ملاحظة",
        "note_text": "تستند بعض النتائج إلى إجابات قدمها المستخدم في مقابلة توضيح المنتج، وكل نتيجة من هذا النوع تقتبس الإجابة التي بُنيت عليها.",
        "path_label": "مسار الامتثال",
        "projection": "معالجة الثغرات المفتوحة ({n}) ترفع نسبة الامتثال إلى {p}%. بنود المراجعة لا تتغير بهذا الإسقاط، والحساب ناتج عن معادلة التقييم الثابتة نفسها.",
        "gate_label": "سقف الدرجة",
        "gate_high": "سقف الدرجة {cap}: فجوة مؤكدة عالية الخطورة ({refs}) تضع المنتج في النطاق مرتفع المخاطر بغض النظر عن نقاط القوة الأخرى.",
        "gate_medium": "سقف الدرجة {cap}: فجوة مؤكدة متوسطة الخطورة ({refs}) تستبعد النطاق منخفض المخاطر.",
        "driver_gaps": "المؤثر الرئيسي على الدرجة: فجوات مؤكدة",
        "driver_reviews": "المؤثر الرئيسي على الدرجة: نقاط بحاجة لمراجعة، وليست فجوات مؤكدة",
        "driver_mixed": "الدرجة متأثرة بالتساوي بين الفجوات المؤكدة والنقاط التي تحتاج لمراجعة",
        "impact": "الأثر على الدرجة",
        "roadmap": "خارطة المعالجة",
        "roadmap_note": "الثغرات والبنود التي تتطلب مراجعة، مرتبة حسب الحالة والخطورة. عالجها بهذا الترتيب.",
        "col_pri": "الأولوية", "col_req": "المتطلب", "col_action": "الإجراء المطلوب",
        "col_signoff": "الجهة المسؤولة والاعتماد", "col_basis": "الأساس التنظيمي",
        "signoff": "اعتماد", "target": "التاريخ المستهدف",
        "findings": "جميع النتائج",
        "findings_caption": "{n} نتائج · كل نتيجة تقتبس النص التنظيمي الحرفي الذي استندت إليه.",
        "verbatim": "النص التنظيمي الحرفي",
        "verbatim_note": "النص الحرفي بالإنجليزية كما نُشر في النظام الأصلي حفاظاً على دقة الاقتباس",
        "attribution": "بناءً على إجابتك في المقابلة:",
        "analysis": "التحليل", "recommendation": "التوصية",
        "status": {"compliant": "متوافق", "gap": "فجوة", "needs_review": "بحاجة لمراجعة"},
        "risk_l": {"low": "منخفض", "medium": "متوسط", "high": "مرتفع"},
        "none": "لا توجد ثغرات، جميع المتطلبات المفحوصة متوافقة.",
        "appendix": "الملحق: أسئلة المقابلة التوضيحية وإجاباتها",
        "appendix_note": "تستند بعض النتائج أعلاه إلى هذه الإجابات كما هو موضح عند كل نتيجة.",
        "scope": "النطاق والمنهجية",
        "scope_body": "فُحص وصف المنتج وإجابات المقابلة مقابل {n} مادة تنظيمية مفهرسة (إصدار القاعدة {v}) تغطي ساما وحماية البيانات الشخصية والمعايير الشرعية وهيئة السوق المالية، عبر بحث دلالي ثنائي اللغة. كل نتيجة تقتبس نص المادة المسترجعة حرفياً، ونسبة الامتثال تُحسب بمعادلة عقوبات ثابتة من حالة كل نتيجة ومستوى خطورتها، مع قواعد سقف حسب الخطورة: وجود فجوة مؤكدة عالية أو متوسطة الخطورة يحدد سقف الدرجة، فلا يعوض الخلل الجوهري بنقاط القوة الأخرى. النسبة مؤشر جاهزية تنظيمية وأداة فرز لترتيب أولويات المعالجة والمراجعة، وليست حكماً قانونياً. نهاية التقرير.",
        "running_score": "النسبة {s} / 100 · مخاطر {r}",
    },
    "en": {
        "dir": "ltr", "brand": "ComplyX · ضامن", "tagline": "REGULATORY COMPLIANCE ANALYSIS",
        "kicker": "Compliance Assessment Report",
        "product_line": "Product type: {pt} · Kingdom of Saudi Arabia",
        "session_ref": "Session reference", "date": "Scan date", "corpus": "Corpus version",
        "coverage": "Coverage", "coverage_val": "{n} indexed articles · SAMA, SDAIA, AAOIFI, CMA",
        "score_label": "Compliance score", "out_of": "out of 100",
        "score_caption": "Computed by deterministic scoring rules from finding statuses and risk weights. The score is arithmetic, not an AI judgment.",
        "gaps": "Gaps", "reviews": "Needs review", "compliants": "Compliant",
        "by_regulator": "Findings by regulator",
        "risk_chip": {"low": "LOW RISK", "medium": "MEDIUM RISK", "high": "HIGH RISK"},
        "summary": "Executive summary",
        "note_label": "NOTE",
        "note_text": "Some findings are based on answers given during the product interview. Each such finding cites the answer it relies on.",
        "path_label": "PATH TO COMPLIANT",
        "projection": "Resolving the {n} open gap(s) raises the compliance score to {p}%. Items under review are unchanged by this projection; the number comes from the same fixed scoring formula.",
        "gate_label": "SCORE CAP",
        "gate_high": "Score capped at {cap}: a high-severity confirmed gap ({refs}) places the product in the high-risk band regardless of other strengths.",
        "gate_medium": "Score capped at {cap}: a confirmed moderate gap ({refs}) rules out the low-risk band.",
        "driver_gaps": "Main score driver: confirmed gaps",
        "driver_reviews": "Main score driver: items needing review, not confirmed gaps",
        "driver_mixed": "Score driven equally by confirmed gaps and items needing review",
        "impact": "Score impact",
        "roadmap": "Remediation roadmap",
        "roadmap_note": "Gap and needs-review findings, ordered by status and severity. Resolve in this order.",
        "col_pri": "Pri.", "col_req": "Requirement", "col_action": "Required action",
        "col_signoff": "Ownership & sign-off", "col_basis": "Regulatory basis",
        "signoff": "Sign-off", "target": "Target date",
        "findings": "All findings",
        "findings_caption": "{n} findings · Each cites the verbatim regulation text it is based on.",
        "verbatim": "Verbatim regulation text",
        "verbatim_note": "",
        "attribution": "Based on your interview answer:",
        "analysis": "Analysis", "recommendation": "Recommendation",
        "status": {"compliant": "COMPLIANT", "gap": "GAP", "needs_review": "NEEDS REVIEW"},
        "risk_l": {"low": "Low", "medium": "Medium", "high": "High"},
        "none": "No gaps found. All checked requirements are compliant.",
        "appendix": "Appendix: Clarification Interview Questions and Answers",
        "appendix_note": "Some findings above are based on these answers, as marked on each finding.",
        "scope": "Scope and method",
        "scope_body": "This assessment checked the product description and interview answers against {n} indexed regulatory articles (corpus version {v}) covering SAMA, SDAIA personal data protection, AAOIFI Shariah standards and CMA, using bilingual semantic retrieval. Every finding quotes the retrieved article text verbatim, and the compliance score is computed by a fixed penalty formula over finding statuses and risk levels, with severity gates: any confirmed high or medium severity gap caps the score, so a critical breach is never offset by strengths elsewhere. The score is a regulatory readiness index and a triage signal for prioritizing remediation and review, not a legal determination. End of report.",
        "running_score": "Score {s} / 100 · {r} risk",
    },
}

_STATUS_COLOR = {"compliant": "#147a5b", "gap": "#b42318", "needs_review": "#a15c09"}
_STATUS_TINT = {"gap": ("#fbeae8", "#eccbc7"), "needs_review": ("#f9efe0", "#ead7b8"), "compliant": ("#e7f3ee", "#c8e2d6")}
_RISK_COLOR = {"high": "#b42318", "medium": "#a15c09", "low": "#147a5b"}

_LOGO_SVG = (
    '<svg width="26" height="30" viewBox="0 0 120 132" aria-hidden="true">'
    '<path d="M60 6 L108 24 V66 C108 100 60 124 60 124 C60 124 12 100 12 66 V24 Z" fill="none" stroke="#b79a57" stroke-width="8"></path>'
    '<path d="M60 18 L98 32 V66 C98 92 60 111 60 111 C60 111 22 92 22 66 V32 Z" fill="#12a8a0"></path>'
    '<path d="M60 18 L98 32 V66 C98 92 60 111 60 111 Z" fill="#006b68"></path>'
    '<polyline points="42,66 55,80 80,50" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>'
)


def _e(text: str) -> str:
    return html.escape(text or "")


_PRODUCT_TYPE_LABEL = {
    "payment_services": {"en": "Payment services", "ar": "خدمات الدفع"},
    "consumer_finance": {"en": "Consumer finance", "ar": "التمويل الاستهلاكي"},
    "open_banking": {"en": "Open banking", "ar": "الخدمات المصرفية المفتوحة"},
    "aml": {"en": "Anti-money laundering", "ar": "مكافحة غسل الأموال"},
    "pdpl": {"en": "Personal data protection", "ar": "حماية البيانات الشخصية"},
    "general": {"en": "General financial product", "ar": "منتج مالي عام"},
}


def _product_type_label(product_type: str, lang: str) -> str:
    entry = _PRODUCT_TYPE_LABEL.get(product_type)
    if entry:
        return entry[lang]
    return product_type.replace("_", " ").capitalize()


def _dial(score: int, risk: str) -> str:
    """Static score dial: SVG arc sized to the score, colored by risk."""
    circumference = 2 * 3.14159 * 52
    dash = circumference * score / 100
    color = _RISK_COLOR.get(risk, "#a15c09")
    return f"""<div class="dial">
      <svg width="170" height="170" viewBox="0 0 120 120" style="transform:rotate(-90deg)">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#e8f0f0" stroke-width="10"></circle>
        <circle cx="60" cy="60" r="52" fill="none" stroke="{color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="{dash:.1f} {circumference:.1f}"></circle>
      </svg>
      <div class="dial-center"><span class="dial-num">{score}</span><span class="dial-sub">{{out_of}}</span></div>
    </div>"""


def _build_html(req: ReportPdfRequest) -> str:
    lang = req.lang if req.lang in ("ar", "en") else "ar"
    t = _T[lang]
    r = req.result
    risk_color = _RISK_COLOR.get(r.risk_level, "#a15c09")
    review_count = sum(1 for f in r.findings if f.status == "needs_review")
    compliant_count = sum(1 for f in r.findings if f.status == "compliant")
    has_attribution = any(f.user_answer_ref for f in r.findings)
    session_ref = _e(req.session_ref) or "CX-2026"

    try:
        from ..retriever import count_indexed
        indexed = f"{count_indexed():,}"
    except Exception:
        indexed = "9,500+"

    # ── Roadmap rows ──
    actionable = [f for f in r.findings if f.status in ("gap", "needs_review")]
    actionable.sort(key=lambda f: (_STATUS_ORDER[f.status], _RISK_ORDER.get(f.risk, 1)))
    finding_index = {id(f): i for i, f in enumerate(r.findings, 1)}

    def _row(i: int, f) -> str:
        tint_bg, tint_border = _STATUS_TINT[f.status]
        return f"""<tr>
          <td class="td pri-td"><span class="pri-dot" style="background:{_STATUS_COLOR[f.status]}">{i}</span></td>
          <td class="td"><div class="req-cell"><span class="req-title">{_e(f.requirement.title)} (F-{finding_index[id(f)]:02d})</span>
            <span class="row-pill" style="color:{_STATUS_COLOR[f.status]};background:{tint_bg};border-color:{tint_border}">{t['status'][f.status]} · {t['risk_l'].get(f.risk, f.risk)}</span></div></td>
          <td class="td action-td">{_e(f.recommendation)}</td>
          <td class="td signoff-td"><span class="owner-chip">{_owner(f.recommendation + ' ' + f.analysis, lang)}</span>
            <div class="signoff-row"><span class="cbx"></span>{t['signoff']}</div>
            <div class="signoff-row">{t['target']}: <span class="fill-line"></span></div></td>
          <td class="td basis-td"><span dir="ltr">{_e(f.requirement.regulator or 'SAMA')} · {_e(f.requirement.source)}<br>{_e(f.requirement.article)}</span></td>
        </tr>"""

    roadmap_rows = "".join(_row(i, f) for i, f in enumerate(actionable, 1)) \
        or f'<tr><td colspan="5" class="td empty">{t["none"]}</td></tr>'

    # ── Finding cards ──
    penalties = r.score_breakdown.penalties
    gate = r.score_breakdown.gate

    def _card(i: int, f) -> str:
        status_color = _STATUS_COLOR[f.status]
        risk_chip_color = _RISK_COLOR.get(f.risk, "#a15c09")
        attribution = (
            f'<div class="attrib"><strong>{t["attribution"]}</strong> &laquo;{_e(f.user_answer_ref)}&raquo;</div>'
            if f.user_answer_ref else ""
        )
        verbatim_note = f'<span class="verbatim-note">{t["verbatim_note"]}</span>' if t["verbatim_note"] else ""
        pen = penalties[i - 1] if i - 1 < len(penalties) else 0
        pen_html = f'<span class="pen-label">{t["impact"]}: <b dir="ltr">-{pen}</b></span>' if pen > 0 else ""
        return f"""<article class="finding" style="border-inline-start-color:{status_color}">
          <div class="f-top">
            <div class="f-id-col">
              <div class="f-id-row"><span class="f-num">F-{i:02d}</span><span class="reg-tag">{_e(f.requirement.regulator or 'SAMA')}</span></div>
              <h3 class="f-title" dir="auto">{_e(f.requirement.title)}</h3>
              <span class="f-src" dir="ltr">{_e(f.requirement.source)} · {_e(f.requirement.article)}</span>
            </div>
            <div class="f-status-col">
              <span class="status-pill" style="background:{status_color}">{t['status'][f.status]}</span>
              <span class="risk-label" style="color:{risk_chip_color}">{t['risk_chip'].get(f.risk, f.risk)}</span>
              {pen_html}
            </div>
          </div>
          <div class="verbatim" dir="ltr">
            <span class="verbatim-label">{t['verbatim']}</span>
            <p>&quot;{_e(clean_excerpt(f.requirement.text, 600))}&quot;</p>
            {verbatim_note}
          </div>
          {attribution}
          <div class="ar-grid">
            <div class="analysis"><span class="mini-label">{t['analysis']}</span><p>{_e(f.analysis)}</p></div>
            <div class="reco"><span class="mini-label reco-label">{t['recommendation']}</span><p>{_e(f.recommendation)}</p></div>
          </div>
        </article>"""

    findings_blocks = "".join(_card(i, f) for i, f in enumerate(r.findings, 1))

    # ── Cover extras ──
    reg_counts = Counter((f.requirement.regulator or "SAMA") for f in r.findings)
    reg_chips = "".join(
        f'<span class="reg-chip">{_e(reg)} {count}</span>'
        for reg, count in sorted(reg_counts.items(), key=lambda item: -item[1])
    )

    projection_html = ""
    if r.gaps_count > 0:
        projected = projected_score(r.findings)
        if projected > r.compliance_score:
            projection_html = (
                f'<div class="gold-band"><span class="gold-label">{t["path_label"]}</span>'
                f'<span class="gold-text">{t["projection"].format(n=r.gaps_count, p=projected)}</span></div>'
            )

    gate_band_html = ""
    if gate:
        refs = ", ".join(f"F-{i + 1:02d}" for i in gate.findings)
        gate_key = "gate_high" if gate.kind == "high_gap" else "gate_medium"
        gate_cls = "is-high" if gate.kind == "high_gap" else "is-medium"
        gate_band_html = (
            f'<div class="gate-band {gate_cls}"><span class="gate-label">{t["gate_label"]}</span>'
            f'<span class="gate-text">{t[gate_key].format(cap=gate.cap, refs=refs)}</span></div>'
        )

    driver_key = {"gaps": "driver_gaps", "reviews": "driver_reviews", "mixed": "driver_mixed"}.get(r.score_breakdown.driver)
    driver_html = f'<p class="score-driver">{t[driver_key]}</p>' if driver_key else ""

    note_html = ""
    if has_attribution:
        note_html = (
            f'<div class="gold-band"><span class="gold-label">{t["note_label"]}</span>'
            f'<span class="gold-text">{t["note_text"]}</span></div>'
        )

    appendix_html = ""
    if req.interview:
        qa_rows = "".join(
            f'<div class="qa"><p class="qa-q">{i}. {_e(item.question)}</p><p class="qa-a">{_e(item.answer)}</p></div>'
            for i, item in enumerate(req.interview, 1)
        )
        appendix_html = f"""<div class="sect-head"><h2>{t['appendix']}</h2><div class="gold-rule"></div>
      <p class="sect-note">{t['appendix_note']}</p></div>{qa_rows}"""

    dial_html = _dial(r.compliance_score, r.risk_level).replace("{out_of}", t["out_of"])

    return f"""<!doctype html>
<html lang="{lang}" dir="{t['dir']}">
<head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; color: #10272e; margin: 0; font-size: 11px; line-height: 1.65; }}

  .cover-head {{ background: linear-gradient(135deg, #073743, #062d35); padding: 34px 56px 38px; display: flex; flex-direction: column; gap: 24px; }}
  .cover-brand-row {{ display: flex; align-items: center; justify-content: space-between; }}
  .cover-brand {{ display: flex; align-items: center; gap: 10px; color: #ffffff; font-size: 15px; font-weight: 700; }}
  .cover-tagline {{ color: #16d7c5; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; }}
  .cover-kicker {{ color: #b79a57; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }}
  .cover-title {{ color: #ffffff; font-size: 32px; font-weight: 800; line-height: 1.4; margin: 4px 0 0; }}
  .cover-sub {{ color: #9fc0c4; font-size: 12.5px; margin-top: 4px; }}

  .meta {{ display: grid; grid-template-columns: 1fr 1fr 1fr 1.5fr; background: #eef6f5; border-bottom: 1px solid #d9e5e6; }}
  .meta > div {{ padding: 13px 16px; display: flex; flex-direction: column; gap: 2px; }}
  .meta > div:first-child {{ padding-inline-start: 56px; }}
  .meta > div:last-child {{ padding-inline-end: 56px; }}
  .meta > div + div {{ border-inline-start: 1px solid #d9e5e6; }}
  .meta-label {{ color: #65777d; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }}
  .meta-val {{ color: #10272e; font-size: 11.5px; font-weight: 700; }}

  .score-block {{ padding: 34px 56px 4px; display: flex; align-items: center; gap: 40px; }}
  .dial {{ position: relative; width: 170px; height: 170px; flex-shrink: 0; }}
  .dial-center {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
  .dial-num {{ font-size: 48px; font-weight: 800; line-height: 1; color: #10272e; }}
  .dial-sub {{ font-size: 11px; font-weight: 600; color: #65777d; }}
  .score-side {{ display: flex; flex-direction: column; gap: 12px; flex: 1; }}
  .risk-row {{ display: flex; align-items: center; gap: 12px; }}
  .risk-chip {{ color: #ffffff; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; border-radius: 4px; padding: 4px 14px; }}
  .score-label {{ color: #65777d; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }}
  .score-caption {{ color: #65777d; font-size: 11px; line-height: 1.6; margin: 0; max-width: 420px; }}
  .stats {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; max-width: 430px; }}
  .stat {{ border: 1px solid #d9e5e6; border-top-width: 3px; border-radius: 4px; padding: 9px 13px; display: flex; flex-direction: column; gap: 1px; }}
  .stat-num {{ font-size: 22px; font-weight: 800; line-height: 1.1; }}
  .stat-label {{ color: #65777d; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }}
  .reg-row {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
  .reg-row-label {{ color: #65777d; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }}
  .reg-chip {{ background: #eef6f5; border: 1px solid #cfe5e2; border-radius: 999px; color: #006b68; font-size: 10px; font-weight: 800; padding: 1px 10px; }}

  .cover-body {{ padding: 24px 56px 30px; display: flex; flex-direction: column; gap: 13px; }}
  .sect-head h2 {{ color: #073743; font-size: 16px; font-weight: 800; margin: 0; }}
  .gold-rule {{ background: #b79a57; height: 3px; margin-top: 5px; width: 44px; }}
  .sect-note {{ color: #65777d; font-size: 11px; margin: 5px 0 0; }}
  .summary-p {{ border-inline-start: 3px solid #b79a57; color: #10272e; font-size: 12.5px; line-height: 1.7; margin: 6px 0 0; padding-inline-start: 18px; }}
  .gold-band {{ background: #f3ead4; border-radius: 4px; display: flex; gap: 10px; align-items: baseline; padding: 11px 17px; }}
  .gold-label {{ color: #8a6d1f; flex-shrink: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; }}
  .gold-text {{ color: #8a6d1f; font-size: 11px; line-height: 1.6; }}
  .gate-band {{ border-radius: 4px; display: flex; gap: 10px; align-items: baseline; margin-bottom: 12px; padding: 11px 17px; }}
  .gate-band.is-high {{ background: #fbeae8; border: 1px solid #eccbc7; }}
  .gate-band.is-high .gate-label, .gate-band.is-high .gate-text {{ color: #8a1f15; }}
  .gate-band.is-medium {{ background: #f9efe0; border: 1px solid #ead7b8; }}
  .gate-band.is-medium .gate-label, .gate-band.is-medium .gate-text {{ color: #6f4106; }}
  .gate-label {{ flex-shrink: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; }}
  .gate-text {{ font-size: 11px; line-height: 1.6; }}
  .score-driver {{ color: #65777d; font-size: 10.5px; font-weight: 700; margin: 4px 0 0; }}
  .pen-label {{ color: #65777d; font-size: 9px; font-weight: 700; }}
  .cover-break {{ page-break-after: always; }}

  main {{ padding: 26px 56px 30px; }}
  main .sect-head {{ margin: 22px 0 12px; }}
  main .sect-head:first-child {{ margin-top: 0; }}

  table {{ border-collapse: collapse; font-size: 11px; width: 100%; }}
  th {{ border-bottom: 2px solid #073743; color: #65777d; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; padding: 7px 9px; text-align: start; text-transform: uppercase; }}
  .td {{ border-bottom: 1px solid #d9e5e6; padding: 11px 9px; vertical-align: top; }}
  .pri-td {{ width: 34px; }}
  .pri-dot {{ align-items: center; border-radius: 50%; color: #ffffff; display: inline-flex; font-size: 11px; font-weight: 800; height: 22px; justify-content: center; width: 22px; }}
  .req-cell {{ display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }}
  .req-title {{ font-weight: 700; line-height: 1.4; }}
  .row-pill {{ border: 1px solid; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: 0.04em; padding: 1px 9px; }}
  .action-td {{ line-height: 1.55; }}
  .signoff-td {{ width: 110px; }}
  .owner-chip {{ border: 1px solid #d9e5e6; border-radius: 4px; color: #073743; font-size: 10px; font-weight: 700; padding: 2px 8px; white-space: nowrap; }}
  .signoff-row {{ align-items: center; color: #65777d; display: flex; font-size: 8.5px; gap: 5px; margin-top: 6px; }}
  .cbx {{ border: 1.3px solid #65777d; border-radius: 2px; display: inline-block; flex-shrink: 0; height: 9px; width: 9px; }}
  .fill-line {{ border-bottom: 1px solid #9db1b5; display: inline-block; height: 8px; min-width: 44px; }}
  .basis-td {{ color: #65777d; font-size: 10px; line-height: 1.5; width: 130px; }}
  .empty {{ color: #147a5b; font-weight: 700; text-align: center; }}

  .finding {{ border: 1px solid #d9e5e6; border-inline-start-width: 4px; border-radius: 6px; display: flex; flex-direction: column; gap: 11px; margin: 12px 0; padding: 16px 20px; page-break-inside: avoid; }}
  .f-top {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }}
  .f-id-col {{ display: flex; flex-direction: column; gap: 3px; }}
  .f-id-row {{ align-items: center; display: flex; gap: 10px; }}
  .f-num {{ color: #65777d; font-family: 'Courier New', monospace; font-size: 11px; font-weight: 700; }}
  .reg-tag {{ background: #eef6f5; border: 1px solid #d9e5e6; border-radius: 4px; color: #006b68; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; padding: 1px 8px; }}
  .f-title {{ color: #10272e; font-size: 14px; font-weight: 700; line-height: 1.4; margin: 0; }}
  .f-src {{ color: #65777d; font-size: 10px; }}
  .f-status-col {{ align-items: flex-end; display: flex; flex-direction: column; flex-shrink: 0; gap: 5px; }}
  .status-pill {{ border-radius: 999px; color: #ffffff; font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; padding: 2px 12px; }}
  .risk-label {{ font-size: 9px; font-weight: 800; letter-spacing: 0.08em; }}
  .verbatim {{ background: #f6fafa; border: 1px solid #d9e5e6; border-inline-start: 3px solid #006b68; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; padding: 10px 15px; text-align: start; }}
  .verbatim-label {{ color: #006b68; font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }}
  .verbatim p {{ color: #10272e; font-size: 10.5px; line-height: 1.6; margin: 0; }}
  .verbatim-note {{ color: #65777d; font-size: 8.5px; }}
  .attrib {{ background: #f3ead4; border-radius: 4px; color: #8a6d1f; font-size: 10.5px; line-height: 1.55; padding: 8px 13px; }}
  .attrib strong {{ font-weight: 800; }}
  .ar-grid {{ display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }}
  .mini-label {{ color: #65777d; display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 3px; text-transform: uppercase; }}
  .reco-label {{ color: #006b68; }}
  .analysis p, .reco p {{ color: #10272e; font-size: 10.5px; line-height: 1.6; margin: 0; }}
  .reco {{ background: #eef6f5; border-radius: 4px; padding: 9px 13px; }}

  .qa {{ border-inline-start: 2px solid #d9e5e6; margin: 9px 0; padding-inline-start: 13px; page-break-inside: avoid; }}
  .qa-q {{ font-size: 11px; font-weight: 700; margin: 0 0 2px; }}
  .qa-a {{ color: #006b68; font-size: 11px; font-weight: 600; margin: 0; }}

  .scope {{ border-top: 2px solid #073743; margin-top: 24px; padding-top: 14px; }}
  .scope-label {{ color: #073743; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }}
  .scope p {{ color: #65777d; font-size: 10.5px; line-height: 1.65; margin: 6px 0 0; }}
</style></head>
<body>
  <div class="cover-break">
    <div class="cover-head">
      <div class="cover-brand-row">
        <div class="cover-brand">{_LOGO_SVG}<span>{t['brand']}</span></div>
        <span class="cover-tagline">{t['tagline']}</span>
      </div>
      <div>
        <div class="cover-kicker">{t['kicker']}</div>
        <h1 class="cover-title" dir="auto">{_e(req.product_label) or _e(_product_type_label(r.product_type, lang))}</h1>
        <div class="cover-sub">{t['product_line'].format(pt=_e(_product_type_label(r.product_type, lang)))}</div>
      </div>
    </div>
    <div class="meta">
      <div><span class="meta-label">{t['session_ref']}</span><span class="meta-val" dir="ltr">{session_ref}</span></div>
      <div><span class="meta-label">{t['date']}</span><span class="meta-val" dir="ltr">{date.today().isoformat()}</span></div>
      <div><span class="meta-label">{t['corpus']}</span><span class="meta-val" dir="ltr">{_e(settings.corpus_version)}</span></div>
      <div><span class="meta-label">{t['coverage']}</span><span class="meta-val" style="font-size:10.5px;font-weight:600">{t['coverage_val'].format(n=indexed)}</span></div>
    </div>
    <div class="score-block">
      {dial_html}
      <div class="score-side">
        <div class="risk-row">
          <span class="risk-chip" style="background:{risk_color}">{t['risk_chip'].get(r.risk_level, r.risk_level)}</span>
          <span class="score-label">{t['score_label']}</span>
        </div>
        <p class="score-caption">{t['score_caption']}</p>
        {driver_html}
        <div class="stats">
          <div class="stat" style="border-top-color:#b42318"><span class="stat-num" style="color:#b42318">{r.gaps_count}</span><span class="stat-label">{t['gaps']}</span></div>
          <div class="stat" style="border-top-color:#a15c09"><span class="stat-num" style="color:#a15c09">{review_count}</span><span class="stat-label">{t['reviews']}</span></div>
          <div class="stat" style="border-top-color:#147a5b"><span class="stat-num" style="color:#147a5b">{compliant_count}</span><span class="stat-label">{t['compliants']}</span></div>
        </div>
        <div class="reg-row"><span class="reg-row-label">{t['by_regulator']}</span>{reg_chips}</div>
      </div>
    </div>
    <div class="cover-body">
      {gate_band_html}
      {projection_html}
      <div class="sect-head"><h2>{t['summary']}</h2><div class="gold-rule"></div></div>
      <p class="summary-p" dir="auto">{_e(r.executive_summary)}</p>
      {note_html}
    </div>
  </div>
  <main>
    <div class="sect-head"><h2>{t['roadmap']}</h2><div class="gold-rule"></div><p class="sect-note">{t['roadmap_note']}</p></div>
    <table>
      <thead><tr><th>{t['col_pri']}</th><th>{t['col_req']}</th><th>{t['col_action']}</th><th>{t['col_signoff']}</th><th>{t['col_basis']}</th></tr></thead>
      <tbody>{roadmap_rows}</tbody>
    </table>
    <div class="sect-head"><h2>{t['findings']}</h2><div class="gold-rule"></div><p class="sect-note">{t['findings_caption'].format(n=len(r.findings))}</p></div>
    {findings_blocks}
    {appendix_html}
    <div class="scope"><span class="scope-label">{t['scope']}</span><p>{t['scope_body'].format(n=indexed, v=_e(settings.corpus_version))}</p></div>
  </main>
</body></html>"""


@router.post("/report-pdf")
def report_pdf(body: ReportPdfRequest):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF export requires Playwright: pip install playwright && playwright install chromium",
        )

    html_doc = _build_html(body)
    ref = html.escape(body.session_ref or "CX-2026")
    disclaimer = html.escape(body.result.disclaimer or "")
    footer_template = (
        '<div style="width:100%; font-size:9.5px; color:#65777d; padding:0 56px; '
        'display:flex; align-items:center; gap:16px; font-family: Tahoma, Arial, sans-serif;">'
        f'<span style="font-weight:700; white-space:nowrap;">ComplyX · ضامن · {ref}</span>'
        f'<span style="flex:1; text-align:center; font-size:9px; line-height:1.4;">{disclaimer}</span>'
        '<span style="font-weight:700; white-space:nowrap;">'
        '<span class="pageNumber"></span>/<span class="totalPages"></span></span></div>'
    )
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            # networkidle lets the Google Fonts request finish when online;
            # offline, Chromium falls back to the system stack after timeout.
            try:
                page.set_content(html_doc, wait_until="networkidle", timeout=8000)
            except Exception:
                pass  # fonts unavailable; content is already set, render with fallback stack
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                display_header_footer=True,
                header_template="<span></span>",
                footer_template=footer_template,
                margin={"top": "0", "bottom": "16mm", "left": "0", "right": "0"},
            )
            browser.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {exc}") from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="complyx-report.pdf"'},
    )
