import { AlertTriangle, CheckCircle2, Download, FileText, ShieldCheck } from "lucide-react";
import { ComplianceResult } from "@/lib/types";

type ReportTone = "executive" | "technical" | "simple";

const statusLabel = {
  compliant: "متوافق",
  gap: "ثغرة",
  needs_review: "يتطلب مراجعة"
};

const riskLabel = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالي"
};

type Props = {
  result: ComplianceResult;
  onDownloadReport: () => void;
  lang?: "ar" | "en";
  tone?: ReportTone;
};

const copy = {
  ar: {
    eyebrow: "تقرير موثق",
    title: "نتيجة فحص الامتثال",
    download: "تحميل",
    score: "نسبة الامتثال",
    risk: "مستوى الخطورة",
    gaps: "الثغرات",
    toneLabel: "أسلوب التقرير",
    tones: {
      executive: "تنفيذي",
      technical: "تقني",
      simple: "مبسّط"
    },
    toneNotes: {
      executive: "موجّه للقرار السريع: يلخص المخاطر، الجاهزية، وما يحتاج موافقة.",
      technical: "موجّه لفرق الامتثال والتقنية: يركز على الضوابط، الأدلة، والإجراءات.",
      simple: "موجّه للقراء غير المتخصصين: يشرح النتيجة بلغة مباشرة وواضحة."
    }
  },
  en: {
    eyebrow: "Verified report",
    title: "Compliance scan result",
    download: "Download",
    score: "Compliance score",
    risk: "Risk level",
    gaps: "Gaps",
    toneLabel: "Report tone",
    tones: {
      executive: "Executive",
      technical: "Technical",
      simple: "Simple"
    },
    toneNotes: {
      executive: "For fast decisions: highlights risk, readiness, and approval needs.",
      technical: "For compliance and technical teams: focuses on controls, evidence, and actions.",
      simple: "For non-specialists: explains the result in direct, plain language."
    }
  }
};

export default function ComplianceReport({ result, onDownloadReport, lang = "ar", tone = "executive" }: Props) {
  const t = copy[lang];
  return (
    <section className="report">
      <div className="report-head">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
        </div>
        <button className="icon-button primary" onClick={onDownloadReport} aria-label="تحميل التقرير">
          <Download size={19} />
          <span>{t.download}</span>
        </button>
      </div>

      <div className="metrics">
        <div className="metric">
          <ShieldCheck size={22} />
          <span>{t.score}</span>
          <strong>{result.compliance_score}%</strong>
        </div>
        <div className="metric">
          <AlertTriangle size={22} />
          <span>{t.risk}</span>
          <strong>{riskLabel[result.risk_level]}</strong>
        </div>
        <div className="metric">
          <FileText size={22} />
          <span>{t.gaps}</span>
          <strong>{result.gaps_count}</strong>
        </div>
      </div>

      <div className="report-tone">
        <span>{t.toneLabel}</span>
        <strong>{t.tones[tone]}</strong>
        <p>{t.toneNotes[tone]}</p>
      </div>

      <p className="summary">{result.executive_summary}</p>

      <div className="findings">
        {result.findings.map((finding, index) => (
          <article className={`finding ${finding.status}`} key={finding.requirement.id} style={{ animationDelay: `${index * 80}ms` }}>
            <div className="finding-top">
              <div>
                <span className="source">{finding.requirement.source} | المادة {finding.requirement.article}</span>
                <h3>{finding.requirement.title}</h3>
              </div>
              <span className="badge">
                {finding.status === "compliant" && <CheckCircle2 size={16} />}
                {statusLabel[finding.status]}
              </span>
            </div>
            <p>{finding.analysis}</p>
            <p className="recommendation">{finding.recommendation}</p>
          </article>
        ))}
      </div>
      <p className="disclaimer">{result.disclaimer}</p>
    </section>
  );
}
