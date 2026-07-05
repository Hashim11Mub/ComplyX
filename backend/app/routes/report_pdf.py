"""
Remediation Roadmap PDF export (audit feature F-2).

Renders a branded, bilingual (RTL-aware) HTML report and prints it to PDF
with headless Chromium via Playwright — WeasyPrint was rejected because its
GTK dependency is fragile on Windows, and Playwright is already used for
testing on this project. Returns 501 with guidance if Playwright is missing.
"""

import html
from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import settings
from ..models import ComplianceResult

router = APIRouter()

_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}
_STATUS_ORDER = {"gap": 0, "needs_review": 1, "compliant": 2}

_TECH_HINTS = ("تشفير", "مصادقة", "تقنية", "أنظمة", "API", "encrypt", "authentication", "technical", "system", "data")
_LEGAL_HINTS = ("عقد", "اتفاقية", "قانون", "ترخيص", "contract", "agreement", "legal", "licen")


class ReportPdfRequest(BaseModel):
    result: ComplianceResult
    lang: str = "ar"
    product_label: str = ""


def _owner(text: str, lang: str) -> str:
    lowered = text.lower()
    if any(h.lower() in lowered for h in _TECH_HINTS):
        return "التقنية" if lang == "ar" else "Technology"
    if any(h.lower() in lowered for h in _LEGAL_HINTS):
        return "الشؤون القانونية" if lang == "ar" else "Legal"
    return "الالتزام" if lang == "ar" else "Compliance"


_T = {
    "ar": {
        "dir": "rtl", "title": "تقرير فحص الامتثال", "subtitle": "ضامن · ComplyX",
        "product": "المنتج", "date": "تاريخ الفحص", "corpus": "إصدار قاعدة اللوائح",
        "score": "نسبة الامتثال", "risk": "مستوى المخاطر", "gaps": "الثغرات",
        "summary": "الملخص التنفيذي", "roadmap": "خارطة المعالجة",
        "roadmap_note": "الثغرات والبنود التي تتطلب مراجعة، مرتبة حسب الأولوية",
        "col_pri": "الأولوية", "col_req": "المتطلب", "col_action": "الإجراء المطلوب",
        "col_owner": "الجهة المسؤولة", "col_basis": "الأساس التنظيمي",
        "findings": "جميع النتائج", "analysis": "التحليل", "recommendation": "التوصية",
        "verbatim": "النص التنظيمي (حرفي)",
        "status": {"compliant": "متوافق", "gap": "فجوة", "needs_review": "بحاجة لمراجعة"},
        "risk_l": {"low": "منخفض", "medium": "متوسط", "high": "مرتفع"},
        "none": "لا توجد ثغرات — جميع المتطلبات المفحوصة متوافقة.",
    },
    "en": {
        "dir": "ltr", "title": "Compliance Scan Report", "subtitle": "ComplyX · ضامن",
        "product": "Product", "date": "Scan date", "corpus": "Corpus version",
        "score": "Compliance score", "risk": "Risk level", "gaps": "Gaps",
        "summary": "Executive summary", "roadmap": "Remediation roadmap",
        "roadmap_note": "Gaps and review items, ordered by priority",
        "col_pri": "Priority", "col_req": "Requirement", "col_action": "Required action",
        "col_owner": "Owner", "col_basis": "Regulatory basis",
        "findings": "All findings", "analysis": "Analysis", "recommendation": "Recommendation",
        "verbatim": "Regulation text (verbatim)",
        "status": {"compliant": "Compliant", "gap": "Gap", "needs_review": "Needs review"},
        "risk_l": {"low": "Low", "medium": "Medium", "high": "High"},
        "none": "No gaps found — all checked requirements are compliant.",
    },
}

_STATUS_COLOR = {"compliant": "#147a5b", "gap": "#b42318", "needs_review": "#a15c09"}


def _e(text: str) -> str:
    return html.escape(text or "")


def _build_html(req: ReportPdfRequest) -> str:
    lang = req.lang if req.lang in ("ar", "en") else "ar"
    t = _T[lang]
    r = req.result

    actionable = [f for f in r.findings if f.status in ("gap", "needs_review")]
    actionable.sort(key=lambda f: (_STATUS_ORDER[f.status], _RISK_ORDER.get(f.risk, 1)))

    roadmap_rows = "".join(
        f"""<tr>
          <td class="pri pri-{f.risk}">{i}</td>
          <td><strong>{_e(f.requirement.title)}</strong><br>
              <span class="pill" style="color:{_STATUS_COLOR[f.status]}">{t['status'][f.status]} · {t['risk_l'].get(f.risk, f.risk)}</span></td>
          <td>{_e(f.recommendation)}</td>
          <td>{_owner(f.recommendation + ' ' + f.analysis, lang)}</td>
          <td class="basis">{_e(f.requirement.regulator or 'SAMA')} — {_e(f.requirement.source)}<br>{_e(f.requirement.article)}</td>
        </tr>"""
        for i, f in enumerate(actionable, 1)
    ) or f'<tr><td colspan="5" class="empty">{t["none"]}</td></tr>'

    findings_blocks = "".join(
        f"""<div class="finding">
          <div class="f-head">
            <span class="f-num">F-{i:02d}</span>
            <span class="pill" style="color:{_STATUS_COLOR[f.status]}">{t['status'][f.status]}</span>
            <strong>{_e(f.requirement.title)}</strong>
            <span class="f-src">{_e(f.requirement.regulator or 'SAMA')} · {_e(f.requirement.source)} · {_e(f.requirement.article)}</span>
          </div>
          <p class="label">{t['verbatim']}</p>
          <blockquote dir="auto">{_e(f.requirement.text[:600])}</blockquote>
          <p class="label">{t['analysis']}</p>
          <p>{_e(f.analysis)}</p>
          <p class="label">{t['recommendation']}</p>
          <p>{_e(f.recommendation)}</p>
        </div>"""
        for i, f in enumerate(r.findings, 1)
    )

    return f"""<!doctype html>
<html lang="{lang}" dir="{t['dir']}">
<head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #10272e; margin: 0; font-size: 11px; line-height: 1.7; }}
  .head {{ background: #073743; color: #fff; padding: 26px 34px; }}
  .head h1 {{ margin: 0 0 2px; font-size: 21px; }}
  .head .sub {{ color: #8fe8df; font-size: 11px; letter-spacing: .08em; }}
  .meta {{ display: flex; gap: 26px; padding: 14px 34px; background: #eef6f5; border-bottom: 1px solid #d9e5e6; flex-wrap: wrap; }}
  .meta div span {{ display:block; color: #65777d; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }}
  .meta div strong {{ font-size: 12px; }}
  .score-strong {{ color: #8a6d1f; }}
  main {{ padding: 20px 34px 30px; }}
  h2 {{ font-size: 14px; color: #073743; border-bottom: 2px solid #b79a57; padding-bottom: 4px; margin: 22px 0 4px; }}
  .note {{ color: #65777d; margin: 0 0 10px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #073743; color: #fff; padding: 7px 9px; font-size: 10px; text-align: start; }}
  td {{ border: 1px solid #d9e5e6; padding: 7px 9px; vertical-align: top; }}
  .pri {{ font-weight: 800; text-align: center; width: 34px; }}
  .pri-high {{ color: #b42318; }} .pri-medium {{ color: #a15c09; }} .pri-low {{ color: #147a5b; }}
  .pill {{ font-weight: 700; font-size: 10px; }}
  .basis {{ font-size: 9.5px; color: #3c5a55; }}
  .empty {{ text-align: center; color: #147a5b; font-weight: 700; }}
  .finding {{ border: 1px solid #d9e5e6; border-radius: 8px; padding: 12px 14px; margin: 10px 0; page-break-inside: avoid; }}
  .f-head {{ display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }}
  .f-num {{ font-family: Consolas, monospace; color: #65777d; font-size: 9.5px; }}
  .f-src {{ color: #65777d; font-size: 9.5px; }}
  .label {{ color: #8a6d1f; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; margin: 8px 0 2px; }}
  blockquote {{ margin: 0; padding: 8px 12px; background: #f4f8f8; border-inline-start: 3px solid #12a8a0; font-size: 10px; color: #3c5a55; }}
  .foot {{ padding: 12px 34px; color: #65777d; font-size: 9px; border-top: 1px solid #d9e5e6; }}
</style></head>
<body>
  <div class="head"><h1>{t['title']}</h1><div class="sub">{t['subtitle']}</div></div>
  <div class="meta">
    <div><span>{t['product']}</span><strong>{_e(req.product_label) or _e(r.product_type)}</strong></div>
    <div><span>{t['date']}</span><strong>{date.today().isoformat()}</strong></div>
    <div><span>{t['corpus']}</span><strong>{_e(settings.corpus_version)}</strong></div>
    <div><span>{t['score']}</span><strong class="score-strong">{r.compliance_score}%</strong></div>
    <div><span>{t['risk']}</span><strong>{t['risk_l'].get(r.risk_level, r.risk_level)}</strong></div>
    <div><span>{t['gaps']}</span><strong>{r.gaps_count}</strong></div>
  </div>
  <main>
    <h2>{t['summary']}</h2>
    <p>{_e(r.executive_summary)}</p>
    <h2>{t['roadmap']}</h2>
    <p class="note">{t['roadmap_note']}</p>
    <table>
      <thead><tr><th>{t['col_pri']}</th><th>{t['col_req']}</th><th>{t['col_action']}</th><th>{t['col_owner']}</th><th>{t['col_basis']}</th></tr></thead>
      <tbody>{roadmap_rows}</tbody>
    </table>
    <h2>{t['findings']}</h2>
    {findings_blocks}
  </main>
  <div class="foot">{_e(r.disclaimer)}</div>
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
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_content(html_doc, wait_until="load")
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            )
            browser.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {exc}") from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="complyx-report.pdf"'},
    )
