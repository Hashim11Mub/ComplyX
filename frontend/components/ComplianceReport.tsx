import { AlertTriangle, CheckCircle2, Download, FileText, ShieldCheck } from "lucide-react";
import { ComplianceResult } from "@/lib/types";

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
};

export default function ComplianceReport({ result, onDownloadReport }: Props) {
  return (
    <section className="report">
      <div className="report-head">
        <div>
          <p className="eyebrow">تقرير موثق</p>
          <h2>نتيجة فحص الامتثال</h2>
        </div>
        <button className="icon-button primary" onClick={onDownloadReport} aria-label="تحميل التقرير">
          <Download size={19} />
          <span>تحميل</span>
        </button>
      </div>

      <div className="metrics">
        <div className="metric">
          <ShieldCheck size={22} />
          <span>نسبة الامتثال</span>
          <strong>{result.compliance_score}%</strong>
        </div>
        <div className="metric">
          <AlertTriangle size={22} />
          <span>مستوى الخطورة</span>
          <strong>{riskLabel[result.risk_level]}</strong>
        </div>
        <div className="metric">
          <FileText size={22} />
          <span>الثغرات</span>
          <strong>{result.gaps_count}</strong>
        </div>
      </div>

      <p className="summary">{result.executive_summary}</p>

      <div className="findings">
        {result.findings.map((finding) => (
          <article className={`finding ${finding.status}`} key={finding.requirement.id}>
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
