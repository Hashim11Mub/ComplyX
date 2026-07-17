"use client";

import Link from "next/link";
import AlinmaLogo from "@/components/AlinmaLogo";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const riskCopy = {
  low: { ar: "منخفض", tone: "low" },
  medium: { ar: "متوسط", tone: "medium" },
  high: { ar: "مرتفع", tone: "high" }
} as const;

const automationSteps = [
  {
    title: "استلام تقرير ComplyX",
    meta: "تم ربط التقرير بالطلب",
    body: "نتائج الفحص، الثغرات، والمراجع التنظيمية جاهزة داخل ملف المتابعة."
  },
  {
    title: "مراجعة جاهزية الترخيص",
    meta: "قيد التشغيل",
    body: "تحديد المتطلبات الناقصة وربطها بخطوات قابلة للتنفيذ قبل التقديم."
  },
  {
    title: "تجهيز مسار الإنماء",
    meta: "التالي",
    body: "فتح ملف للفنتك يشمل الحسابات، المدفوعات، وواجهات API المناسبة للنمو."
  }
];

export default function AlinmaDashboardPage() {
  return (
    <Suspense fallback={<div className="alinma-loading">Loading Alinma portal...</div>}>
      <AlinmaDashboardContent />
    </Suspense>
  );
}

function AlinmaDashboardContent() {
  const params = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const ref = params.get("ref") || "CPX-DEMO";
  const score = params.get("score") || "82";
  const gaps = params.get("gaps") || "3";
  const riskKey = (params.get("risk") || "medium").toLowerCase();
  const risk = riskCopy[riskKey as keyof typeof riskCopy] ?? riskCopy.medium;

  const readyPercent = useMemo(() => {
    const value = Number(score);
    if (Number.isNaN(value)) return 82;
    return Math.max(0, Math.min(100, value));
  }, [score]);

  return (
    <main className="alinma-page" dir="rtl">
      <aside className="alinma-sidebar" aria-label="Alinma navigation">
        <div className="alinma-side-top">
          <AlinmaLogo size={42} />
          <div>
            <strong>الإنماء</strong>
            <span>Fintech Portal</span>
          </div>
        </div>
        <nav>
          <a>لوحة البداية</a>
          <a>الحسابات</a>
          <a>المدفوعات</a>
          <a className="is-active">ComplyX Readiness</a>
          <a>واجهات API</a>
          <a>الدعم</a>
        </nav>
        <Link href="/" className="alinma-back">العودة إلى ComplyX</Link>
      </aside>

      <section className="alinma-main">
        <header className="alinma-header">
          <div>
            <span>Alinma + ComplyX</span>
            <h1>متابعة جاهزية الفنتك</h1>
            <p>تقرير ComplyX جاهز. هذه صفحة منفصلة تحوّل نتيجة الفحص إلى خطوات متابعة مع الإنماء.</p>
          </div>
          <div className="alinma-ref">
            <span>رقم الطلب</span>
            <strong>{ref}</strong>
          </div>
        </header>

        <div className="alinma-hero-card">
          <div>
            <span className="alinma-badge">ComplyX check complete</span>
            <h2>ابدأ الخطوة التالية مع الإنماء</h2>
            <p>
              نستخدم نتيجة التقرير لفتح ملف متابعة مختصر: مراجعة الثغرات، اختيار الخدمات البنكية، ثم تجهيز مسار APIs والمدفوعات.
            </p>
            <div className="alinma-actions">
              <button onClick={() => setSubmitted(true)} type="button">
                {submitted ? "تم إرسال الملف للمتابعة" : "إرسال للمتابعة"}
              </button>
              <Link href="/">تحديث الفحص</Link>
            </div>
          </div>
          <div className="alinma-readiness">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="48" />
              <circle cx="60" cy="60" r="48" style={{ strokeDashoffset: 302 - (302 * readyPercent) / 100 }} />
            </svg>
            <strong>{readyPercent}%</strong>
            <span>جاهزية مبدئية</span>
          </div>
        </div>

        <div className="alinma-metrics">
          <div>
            <span>مستوى المخاطر</span>
            <strong className={`risk-${risk.tone}`}>{risk.ar}</strong>
          </div>
          <div>
            <span>الثغرات المفتوحة</span>
            <strong>{gaps}</strong>
          </div>
          <div>
            <span>الخدمات المقترحة</span>
            <strong>حسابات + APIs</strong>
          </div>
        </div>

        <section className="alinma-workflow">
          <div className="alinma-section-title">
            <span>Automation flow</span>
            <h2>الخطوات التالية</h2>
          </div>
          <div className="alinma-steps">
            {automationSteps.map((step, index) => (
              <article key={step.title} className={submitted || index === 0 ? "is-on" : ""}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{step.title}</strong>
                  <em>{submitted && index === 1 ? "بدأت المراجعة" : step.meta}</em>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="alinma-next-panel">
          <span>حزمة الإنماء المقترحة</span>
          <div className="alinma-pill-row">
            <span>حسابات تشغيلية</span>
            <span>مدفوعات</span>
            <span>APIs</span>
            <span>جاهزية ترخيص</span>
          </div>
        </section>
      </section>
    </main>
  );
}
