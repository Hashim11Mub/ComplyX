"use client";

import { Activity, ClipboardCheck, FlaskConical, Layers3, Radar, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AgentSteps from "./AgentSteps";
import ChatConsultation from "./ChatConsultation";
import ComplianceReport from "./ComplianceReport";
import { checkCompliance, downloadReport } from "@/lib/api";
import { ComplianceResult, ProductType } from "@/lib/types";

const productTypes: { value: ProductType; label: string }[] = [
  { value: "consumer_finance", label: "تمويل استهلاكي" },
  { value: "payment_services", label: "خدمات الدفع" },
  { value: "open_banking", label: "بنكية مفتوحة" },
  { value: "pdpl", label: "حماية البيانات" },
  { value: "aml", label: "مكافحة غسل الأموال" },
  { value: "general", label: "عام" }
];

const examples = [
  {
    product_type: "consumer_finance" as ProductType,
    title: "تمويل التقسيط",
    description: "منتج تمويل تقسيط شهري يفصح عن معدل النسبة السنوية والرسوم، لكن لا توجد آلية رسمية لشكاوى العملاء."
  },
  {
    product_type: "payment_services" as ProductType,
    title: "محفظة رقمية",
    description: "محفظة رقمية برصيد يومي وحدود تحويل، تدعم المصادقة الثنائية وتشفير بيانات الدفع ومراقبة الاحتيال."
  },
  {
    product_type: "pdpl" as ProductType,
    title: "تطبيق استثمار",
    description: "تطبيق استثمار يطلب موافقة صريحة لمعالجة البيانات ويوفر حق الاطلاع والتصحيح وسحب الموافقة."
  }
];

const defaultSteps = [
  "استرجاع الأنظمة",
  "استخلاص الاشتراطات",
  "فحص الثغرات",
  "توليد التقرير"
];

export default function ComplianceChecker() {
  const [productType, setProductType] = useState<ProductType>("consumer_finance");
  const [description, setDescription] = useState(examples[0].description);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = useMemo(() => result?.agent_steps ?? defaultSteps, [result]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
    }, 520);
    return () => window.clearInterval(timer);
  }, [loading, steps.length]);

  async function runCheck() {
    setLoading(true);
    setResult(null);
    setCurrentStep(0);
    try {
      const data = await checkCompliance(description, productType);
      setResult(data);
      setCurrentStep(data.agent_steps.length);
    } finally {
      setLoading(false);
    }
  }

  function useExample(index: number) {
    setProductType(examples[index].product_type);
    setDescription(examples[index].description);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">CX</div>
          <div>
            <strong>ComplyX</strong>
            <span>Regulatory Intelligence</span>
          </div>
        </div>
        <div className="top-actions">
          <span>Product compliance cockpit</span>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">AI-ready compliance workspace</p>
          <h1>حوّل وصف المنتج إلى خريطة امتثال قابلة للتنفيذ</h1>
          <p>
            واجهة احترافية لفحص المنتجات المالية، كشف الثغرات، وتجهيز تقرير تنفيذي بسرعة
            مع إبقاء بنية الربط الخلفي جاهزة للتوسع لاحقا.
          </p>
        </div>
        <div className="signal-board" aria-label="Compliance signal overview">
          <div className="signal-orbit">
            <Radar size={34} />
          </div>
          <div className="signal-grid">
            <span>Risk</span>
            <strong>{result ? result.risk_level.toUpperCase() : "READY"}</strong>
            <span>Coverage</span>
            <strong>{result ? `${result.compliance_score}%` : "Mock"}</strong>
            <span>Findings</span>
            <strong>{result ? result.findings.length : "Live UI"}</strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="checker">
          <div className="intro">
            <div>
              <p className="eyebrow">Compliance scan</p>
              <h2>مختبر تقييم المنتج</h2>
            </div>
            <div className="compact-stats">
              <span><Activity size={16} /> Instant scoring</span>
              <span><Layers3 size={16} /> Backend-ready</span>
            </div>
          </div>

          <div className="control-row">
            {productTypes.map((type) => (
              <button className={productType === type.value ? "chip active" : "chip"} key={type.value} onClick={() => setProductType(type.value)}>
                {type.label}
              </button>
            ))}
          </div>

          <label className="input-label" htmlFor="product-description">وصف المنتج المالي</label>
          <textarea
            id="product-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="صف منتجك المالي هنا..."
          />

          <div className="examples">
            {examples.map((example, index) => (
              <button key={example.title} onClick={() => useExample(index)}>
                <FlaskConical size={16} />
                {example.title}
              </button>
            ))}
          </div>

          <button className="run-button" onClick={runCheck} disabled={loading || description.length < 20}>
            {loading ? <Sparkles size={20} /> : <ClipboardCheck size={20} />}
            {loading ? "جار الفحص..." : "فحص الامتثال"}
          </button>
        </div>

        <aside className="side-stack">
          <AgentSteps steps={steps} currentStep={currentStep} done={Boolean(result) && !loading} />
          <ChatConsultation />
        </aside>
      </section>

      {result && <ComplianceReport result={result} onDownloadReport={() => downloadReport(result)} />}
    </main>
  );
}
