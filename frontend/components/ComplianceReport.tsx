"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ComplianceResult, Lang } from "@/lib/types";

type Props = {
  result: ComplianceResult;
  productName: string;
  onReset: () => void;
  onDownloadReport: () => void;
  lang?: Lang;
};

const RADIUS = 100;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const copy = {
  ar: {
    complete: "اكتمل الفحص",
    newScan: "بدء فحص جديد",
    score: "درجة الامتثال",
    risk: "مستوى المخاطر",
    riskLabels: {
      low: "منخفض",
      medium: "متوسط",
      high: "مرتفع"
    },
    hint: "يرجى معالجة الفجوات الموضحة أدناه قبل التقدم بطلب الترخيص الرسمي إلى ساما.",
    summary: "الملخص التنفيذي",
    findings: "النتائج التفصيلية",
    recommendation: "التوصية",
    download: "تحميل التقرير",
    statuses: {
      compliant: "متوافق",
      gap: "فجوة",
      needs_review: "بحاجة لمراجعة"
    }
  },
  en: {
    complete: "Scan complete",
    newScan: "Start New Scan",
    score: "Compliance Score",
    risk: "Risk Level",
    riskLabels: {
      low: "Low",
      medium: "Medium",
      high: "High"
    },
    hint: "Address gap findings below before submitting your licensing application to SAMA.",
    summary: "Executive Summary",
    findings: "Findings",
    recommendation: "Recommendation",
    download: "Download Report",
    statuses: {
      compliant: "Compliant",
      gap: "Gap",
      needs_review: "Needs Review"
    }
  }
};

export default function ComplianceReport({ result, productName, onReset, onDownloadReport, lang = "ar" }: Props) {
  const t = copy[lang];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialOffset, setDialOffset] = useState(CIRCUMFERENCE);
  const [dialDisplay, setDialDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = CIRCUMFERENCE * (1 - result.compliance_score / 100);
    const timer = window.setTimeout(() => setDialOffset(target), 100);
    const start = performance.now();
    const duration = 1200;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDialDisplay(Math.round(eased * result.compliance_score));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      window.clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [result.compliance_score]);

  const dialColor = result.compliance_score >= 82 ? "var(--ok)" : result.compliance_score >= 58 ? "var(--warning)" : "var(--danger)";
  const riskColor = result.risk_level === "high" ? "var(--danger)" : result.risk_level === "medium" ? "var(--warning)" : "var(--ok)";
  const riskBg =
    result.risk_level === "high" ? "rgba(190, 42, 32, 0.1)" : result.risk_level === "medium" ? "rgba(183, 154, 87, 0.16)" : "rgba(20, 122, 91, 0.12)";
  const sortRank = { gap: 0, needs_review: 1, compliant: 2 } as const;
  const orderedFindings = [...result.findings].sort((a, b) => sortRank[a.status] - sortRank[b.status]);

  return (
    <div className="cx-state-results">
      <div className="cx-results-inner">
        <div className="cx-results-topline">
          <span>
            {t.complete} - {productName}
          </span>
          <button className="cx-new-scan" onClick={onReset} type="button">
            {t.newScan}
          </button>
        </div>

        <div className="cx-score-row">
          <div className="cx-dial-wrap">
            <svg width="180" height="180" viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="14" />
              <circle
                cx="110"
                cy="110"
                r={RADIUS}
                fill="none"
                stroke={dialColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                style={{ strokeDashoffset: dialOffset, transition: "stroke-dashoffset 1.2s cubic-bezier(.16,.84,.44,1)" }}
                transform="rotate(-90 110 110)"
              />
            </svg>
            <div className="cx-dial-center">
              <div className="cx-dial-value" style={{ color: dialColor }}>
                {dialDisplay}
              </div>
              <div className="cx-dial-caption">{t.score}</div>
            </div>
          </div>

          <div className="cx-score-copy">
            <div className={`cx-risk-badge${result.risk_level === "high" ? " is-high" : ""}`} style={{ background: riskBg }}>
              <span className="cx-risk-dot" style={{ background: riskColor }} />
              <span className="cx-risk-text" style={{ color: riskColor }}>
                {t.risk}: {t.riskLabels[result.risk_level]}
              </span>
            </div>
            <div className="cx-results-hint">{t.hint}</div>
          </div>
        </div>

        <div className="cx-summary-card">
          <div className="cx-summary-label">{t.summary}</div>
          <p className="cx-summary-text" dir="rtl">
            {result.executive_summary}
          </p>
        </div>

        <div>
          <div className="cx-findings-label">{t.findings}</div>
          <div className="cx-findings-list">
            {orderedFindings.map((finding, index) => {
              const expanded = expandedId === finding.requirement.id;
              const compliant = finding.status === "compliant";
              const barColor = finding.status === "gap" ? "var(--danger)" : finding.status === "needs_review" ? "var(--warning)" : "var(--ok)";
              const badgeBg =
                finding.status === "gap" ? "rgba(190, 42, 32, 0.1)" : finding.status === "needs_review" ? "rgba(183, 154, 87, 0.16)" : "rgba(20, 122, 91, 0.1)";

              return (
                <article
                  className={`cx-finding-card${compliant ? " is-compliant" : ""}`}
                  key={finding.requirement.id}
                  style={{ borderInlineStartColor: barColor, animationDelay: `${index * 80}ms` }}
                >
                  <button className="cx-finding-header" onClick={() => setExpandedId(expanded ? null : finding.requirement.id)} type="button">
                    <span className="cx-finding-badge" style={{ background: badgeBg, color: barColor }}>
                      {t.statuses[finding.status]}
                    </span>
                    <span className="cx-finding-article">{finding.requirement.article}</span>
                    <span className="cx-finding-title" dir="rtl">
                      {finding.requirement.title}
                    </span>
                    <svg className={`cx-finding-chevron${expanded ? " is-expanded" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div className={`cx-finding-body${expanded ? " is-expanded" : ""}`}>
                    <div className="cx-finding-body-inner" dir="rtl">
                      <p>{finding.analysis}</p>
                      <div className="cx-rec-label">{t.recommendation}</div>
                      <p className="cx-finding-rec">{finding.recommendation}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <button className="cx-download-btn" onClick={onDownloadReport} type="button">
          <Download size={16} strokeWidth={2} />
          {t.download}
        </button>
      </div>
    </div>
  );
}
