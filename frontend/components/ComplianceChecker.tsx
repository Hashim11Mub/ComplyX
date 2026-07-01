"use client";

import {
  Activity,
  ArrowUpLeft,
  BadgeCheck,
  Bot,
  ClipboardCheck,
  FileUp,
  FileSearch,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Mic,
  Radar,
  Repeat,
  SlidersHorizontal,
  ShieldCheck,
  Share2,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import AgentSteps from "./AgentSteps";
import ChatConsultation from "./ChatConsultation";
import ComplianceReport from "./ComplianceReport";
import ShieldScene from "./ShieldScene";
import { checkCompliance, downloadReport } from "@/lib/api";
import { ComplianceResult, ProductType } from "@/lib/types";

type Lang = "ar" | "en";
type ReportTone = "executive" | "technical" | "simple";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const text = {
  ar: {
    cockpit: "Product compliance cockpit",
    eyebrow: "Premium regulatory command center",
    title: "قرارات امتثال أسرع، أوضح، وأكثر ثقة",
    subtitle: "مساحة عمل عربية لفحص المنتجات المالية، تحويل الوصف إلى ضوابط قابلة للتنفيذ، وإخراج تقرير تنفيذي أنيق خلال دقائق.",
    start: "ابدأ الفحص الآن",
    analyzing: "جار التحليل",
    heroNote: "واجهة بسيطة، نتيجة مقنعة، وتجربة عرض جاهزة.",
    risk: "مستوى المخاطر",
    readiness: "نسبة الجاهزية",
    gaps: "الثغرات",
    neutral: "محايد",
    low: "منخفض",
    medium: "متوسط",
    high: "عالي",
    ready: "جاهز",
    labEyebrow: "Regulatory cockpit",
    labTitle: "مختبر تقييم المنتج",
    instant: "تقييم فوري",
    scalable: "قابل للتوسع",
    productType: "نوع المنتج",
    descriptionLabel: "وصف المنتج المالي",
    placeholder: "صف المنتج المالي الذي تخطط لإطلاقه في السعودية: الميزات، المستخدمين، تدفقات الدفع، البيانات، والضوابط التشغيلية...",
    inputTools: "أدوات الإدخال",
    voice: "إملاء صوتي",
    listening: "أستمع الآن",
    upload: "رفع مستند",
    unsupportedFile: "هذا النموذج يقرأ ملفات النصوص مباشرة. للـ PDF أو Word استخدم نص المستند أو اربطه باستخراج backend.",
    fileLoaded: "تم إدخال محتوى المستند",
    reportTone: "أسلوب التقرير",
    tones: {
      executive: "تنفيذي",
      technical: "تقني",
      simple: "مبسّط"
    },
    examples: "جرّب مثالاً",
    scan: "فحص الامتثال",
    scanning: "جار الفحص...",
    submitted: "المنتج قيد التحليل",
    scanTitle: "الوكيل يطابق المنتج مع الضوابط",
    scanSubtitle: "استرجاع، مطابقة، تحليل، ثم توليد نتيجة تنفيذية.",
    decision: "جاهزية القرار",
    updated: "محدث",
    beforeScan: "قبل الفحص",
    decisionEmpty: "ابدأ بفحص منتج واحد. ستظهر نسبة الامتثال، مستوى المخاطر، والثغرات التي تحتاج قرارا قبل الإطلاق.",
    chars: "حرف",
    flow: [
      ["استيعاب المنتج", "وصف واحد يكفي لبدء الفحص"],
      ["مطابقة الضوابط", "إشارات امتثال وثغرات واضحة"],
      ["قرار جاهز", "تقرير تنفيذي قابل للمشاركة"]
    ]
  },
  en: {
    cockpit: "Product compliance cockpit",
    eyebrow: "Premium regulatory command center",
    title: "Faster, clearer, more confident compliance decisions",
    subtitle: "A refined workspace for scanning financial products, mapping regulatory obligations, and producing an executive-ready report in minutes.",
    start: "Start scan",
    analyzing: "Analyzing",
    heroNote: "Simple workflow, convincing output, demo-ready experience.",
    risk: "Risk level",
    readiness: "Readiness",
    gaps: "Gaps",
    neutral: "Neutral",
    low: "Low",
    medium: "Medium",
    high: "High",
    ready: "Ready",
    labEyebrow: "Regulatory cockpit",
    labTitle: "Product assessment lab",
    instant: "Instant scoring",
    scalable: "Scalable",
    productType: "Product type",
    descriptionLabel: "Financial product description",
    placeholder: "Describe the financial product you plan to launch in Saudi Arabia: features, users, payment flows, data handling, and operational controls...",
    inputTools: "Input tools",
    voice: "Voice dictation",
    listening: "Listening",
    upload: "Upload document",
    unsupportedFile: "This prototype reads text files directly. For PDF or Word, paste extracted text or connect backend extraction.",
    fileLoaded: "Document content added",
    reportTone: "Report tone",
    tones: {
      executive: "Executive",
      technical: "Technical",
      simple: "Simple"
    },
    examples: "Try an example",
    scan: "Run compliance scan",
    scanning: "Scanning...",
    submitted: "Product under analysis",
    scanTitle: "The agent is matching product signals to controls",
    scanSubtitle: "Retrieve, match, analyze, then generate an executive-ready result.",
    decision: "Decision readiness",
    updated: "Updated",
    beforeScan: "Before scan",
    decisionEmpty: "Start with one product. You will see compliance score, risk level, and launch blockers before approval.",
    chars: "chars",
    flow: [
      ["Understand product", "One description starts the scan"],
      ["Match controls", "Clear obligations and gaps"],
      ["Ready decision", "Executive report for sharing"]
    ]
  }
};

const productTypes: { value: ProductType; labelAr: string; labelEn: string; icon: LucideIcon }[] = [
  { value: "consumer_finance", labelAr: "تمويل استهلاكي", labelEn: "Consumer finance", icon: Repeat },
  { value: "payment_services", labelAr: "خدمات الدفع", labelEn: "Payment services", icon: Share2 },
  { value: "open_banking", labelAr: "بنكية مفتوحة", labelEn: "Open banking", icon: Layers3 },
  { value: "pdpl", labelAr: "حماية البيانات", labelEn: "Data protection", icon: LockKeyhole },
  { value: "aml", labelAr: "مكافحة غسل الأموال", labelEn: "AML", icon: ShieldCheck },
  { value: "general", labelAr: "عام", labelEn: "General", icon: Bot }
];

const examples = [
  {
    product_type: "consumer_finance" as ProductType,
    titleAr: "تمويل التقسيط",
    titleEn: "Installment finance",
    descriptionAr: "منتج تمويل تقسيط شهري يفصح عن معدل النسبة السنوية والرسوم، لكن لا توجد آلية رسمية لشكاوى العملاء.",
    descriptionEn: "A monthly installment finance product discloses APR and fees, but has no formal customer complaints mechanism."
  },
  {
    product_type: "payment_services" as ProductType,
    titleAr: "محفظة رقمية",
    titleEn: "Digital wallet",
    descriptionAr: "محفظة رقمية برصيد يومي وحدود تحويل، تدعم المصادقة الثنائية وتشفير بيانات الدفع ومراقبة الاحتيال.",
    descriptionEn: "A digital wallet with daily balance and transfer limits, two-factor authentication, encrypted payment data, and fraud monitoring."
  },
  {
    product_type: "pdpl" as ProductType,
    titleAr: "تطبيق استثمار",
    titleEn: "Investment app",
    descriptionAr: "تطبيق استثمار يطلب موافقة صريحة لمعالجة البيانات ويوفر حق الاطلاع والتصحيح وسحب الموافقة.",
    descriptionEn: "An investment app requests explicit consent for data processing and provides access, correction, and consent withdrawal rights."
  }
];

const flowItems = [
  { icon: FileSearch },
  { icon: Radar },
  { icon: BadgeCheck }
];

export default function ComplianceChecker() {
  const [lang, setLang] = useState<Lang>("ar");
  const [productType, setProductType] = useState<ProductType>("consumer_finance");
  const [description, setDescription] = useState(examples[0].descriptionAr);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [scanMode, setScanMode] = useState(false);
  const [tone, setTone] = useState<ReportTone>("executive");
  const [listening, setListening] = useState(false);
  const [fileNotice, setFileNotice] = useState("");
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const t = text[lang];
  const defaultSteps = useMemo(
    () =>
      lang === "ar"
        ? ["استرجاع الأنظمة", "استخلاص الاشتراطات", "مطابقة المنتج", "تحليل الثغرات", "تجهيز التقرير"]
        : ["Retrieve rules", "Extract obligations", "Match product", "Analyze gaps", "Prepare report"],
    [lang]
  );
  const steps = useMemo(() => (result?.agent_steps && lang === "ar" ? result.agent_steps : defaultSteps), [defaultSteps, lang, result]);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

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
    setScanMode(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const data = await checkCompliance(description, productType);
      setResult(data);
      setCurrentStep(data.agent_steps.length);
    } finally {
      setLoading(false);
      window.setTimeout(() => setScanMode(false), 450);
    }
  }

  const currentProduct = productTypes.find((type) => type.value === productType);
  const productLabel = currentProduct ? (lang === "ar" ? currentProduct.labelAr : currentProduct.labelEn) : "";

  function applyExample(index: number) {
    setProductType(examples[index].product_type);
    setDescription(lang === "ar" ? examples[index].descriptionAr : examples[index].descriptionEn);
  }

  function startVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setFileNotice(lang === "ar" ? "المتصفح لا يدعم الإملاء الصوتي حالياً." : "Voice dictation is not supported in this browser yet.");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setDescription((current) => `${current.trim()}${current.trim() ? "\n\n" : ""}${transcript}`.slice(0, 4000));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const textLike = file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(lowerName);
    if (!textLike) {
      setFileNotice(t.unsupportedFile);
      event.target.value = "";
      return;
    }

    const content = await file.text();
    setDescription(content.slice(0, 4000));
    setFileNotice(`${t.fileLoaded}: ${file.name}`);
    event.target.value = "";
  }

  return (
    <main className={scanMode ? "is-scanning" : ""}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <strong>ComplyX</strong>
            <span>Regulatory Intelligence</span>
          </div>
        </div>
        <div className="top-actions">
          <span>{t.cockpit}</span>
          <LockKeyhole size={16} />
          <div className="lang-toggle" aria-label="Language">
            <span className={lang === "ar" ? "lang-indicator is-ar" : "lang-indicator"} />
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} type="button">EN</button>
            <button className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")} type="button">AR</button>
          </div>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="hero-actions">
            <button className="hero-button" onClick={runCheck} disabled={loading || description.length < 20}>
              {loading ? <Sparkles size={19} /> : <ArrowUpLeft size={19} />}
              {loading ? t.analyzing : t.start}
            </button>
            <span>{t.heroNote}</span>
          </div>
        </div>
        <div className="shield-showcase" aria-label="ComplyX shield">
          <ShieldScene />
        </div>
      </section>

      <section className="flow-strip" aria-label="Compliance flow">
        {flowItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={t.flow[index][0]}>
              <Icon size={20} />
              <div>
                <strong>{t.flow[index][0]}</strong>
                <span>{t.flow[index][1]}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="workspace">
        <aside className="workspace-agent" aria-label={lang === "ar" ? "خطوات الوكيل" : "Agent steps"}>
          <div className="workspace-agent-head">
            <span><Bot size={18} /> {lang === "ar" ? "تشغيل الوكيل" : "Agent run"}</span>
            <strong>{loading ? t.scanning : result ? t.updated : t.beforeScan}</strong>
          </div>
          <AgentSteps steps={steps} currentStep={currentStep} done={Boolean(result) && !loading} lang={lang} variant="pipeline" />
        </aside>

        <div className="checker">
          <div className="intro">
            <div>
              <p className="eyebrow">{t.labEyebrow}</p>
              <h2>{t.labTitle}</h2>
            </div>
            <div className="compact-stats">
              <span><Activity size={16} /> {t.instant}</span>
              <span><Layers3 size={16} /> {t.scalable}</span>
            </div>
          </div>

          <label className="input-label">{t.productType}</label>
          <div className="product-card-grid">
            {productTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button className={productType === type.value ? "product-card active" : "product-card"} key={type.value} onClick={() => setProductType(type.value)}>
                  <Icon size={20} />
                  <span>{lang === "ar" ? type.labelAr : type.labelEn}</span>
                </button>
              );
            })}
          </div>

          <label className="input-label" htmlFor="product-description">{t.descriptionLabel}</label>
          <div className="textarea-shell">
            <textarea
              id="product-description"
              value={description}
              maxLength={4000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t.placeholder}
            />
            <span>{description.length} / 4000 {t.chars}</span>
          </div>

          <div className="input-tools" aria-label={t.inputTools}>
            <button className={listening ? "tool-button active" : "tool-button"} type="button" onClick={startVoiceInput}>
              <Mic size={17} />
              {listening ? t.listening : t.voice}
            </button>
            <label className="tool-button file-tool">
              <FileUp size={17} />
              {t.upload}
              <input accept=".txt,.md,.csv,.json,text/*" type="file" onChange={handleDocumentUpload} />
            </label>
            <div className="tone-selector" aria-label={t.reportTone}>
              <span><SlidersHorizontal size={16} /> {t.reportTone}</span>
              {(["executive", "technical", "simple"] as ReportTone[]).map((item) => (
                <button className={tone === item ? "active" : ""} key={item} type="button" onClick={() => setTone(item)}>
                  {t.tones[item]}
                </button>
              ))}
            </div>
          </div>
          {fileNotice && <p className="file-notice">{fileNotice}</p>}

          <div className="examples">
            <span className="examples-label">{t.examples}</span>
            {examples.map((example, index) => (
              <button key={example.titleAr} onClick={() => applyExample(index)}>
                <FlaskConical size={16} />
                {lang === "ar" ? example.titleAr : example.titleEn}
              </button>
            ))}
          </div>

          <button className="run-button" onClick={runCheck} disabled={loading || description.length < 20}>
            {loading ? <Sparkles size={20} /> : <ClipboardCheck size={20} />}
            {loading ? t.scanning : t.scan}
          </button>
        </div>

      </section>

      {scanMode && (
        <section className="scan-stage" aria-live="polite">
          <div className="scan-radar">
            <span className="scan-ring one" />
            <span className="scan-ring two" />
            <span className="scan-ring three" />
            <span className="scan-sweep" />
            <Radar size={34} />
          </div>
          <div className="scan-copy">
            <p className="eyebrow">{t.submitted}</p>
            <h2>{productLabel}</h2>
            <p>{t.scanSubtitle}</p>
          </div>
          <AgentSteps steps={steps} currentStep={currentStep} done={Boolean(result) && !loading} lang={lang} variant="pipeline" />
        </section>
      )}

      {result && <ComplianceReport result={result} onDownloadReport={() => downloadReport(result, { lang, tone })} lang={lang} tone={tone} />}
      <ChatConsultation lang={lang} />
    </main>
  );
}
