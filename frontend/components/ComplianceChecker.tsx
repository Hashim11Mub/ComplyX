"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { askConsultant, checkCompliance, downloadPdfReport, fetchHealth, getProductQuestions, retoneReport, streamCheck } from "@/lib/api";
import type {
  ComplianceResult,
  ClarifyQuestion,
  Corpus,
  Finding,
  HealthInfo,
  ProductType as BackendProductType,
  RetrievedArticle
} from "@/lib/types";

type Lang = "ar" | "en";
type Mode = "describe" | "voice";
type AppState = "input" | "clarifying" | "scanning" | "results";
type Complexity = "simple" | "executive" | "technical";
type Product = {
  id: string;
  en: string;
  ar: string;
  icon: "wallet" | "bnpl" | "gateway" | "robo" | "api" | "crypto";
};

type Preset = {
  id: string;
  en: string;
  ar: string;
  productId: string;
  enText: string;
  arText: string;
};

type StepDef = {
  en: string;
  ar: string;
  icon: "doc" | "scale" | "shield" | "gauge" | "list";
  active: { en: string; ar: string };
  done: { en: string; ar: string };
};

type UploadedFile = {
  name: string;
  meta: string;
};

type ChatMessage = {
  id: number;
  fromUser: boolean;
  text: string;
};

const CIRCUMFERENCE = 2 * Math.PI * 100;

const PRODUCT_TYPE_MAP: Record<string, BackendProductType> = {
  wallet: "payment_services",
  bnpl: "consumer_finance",
  gateway: "payment_services",
  robo: "general",
  api: "open_banking",
  crypto: "general"
};

const PRODUCT_TYPES: Product[] = [
  { id: "wallet", en: "Digital Wallet", ar: "محفظة رقمية", icon: "wallet" },
  { id: "bnpl", en: "Buy Now Pay Later", ar: "الشراء الآجل", icon: "bnpl" },
  { id: "gateway", en: "Payment Gateway", ar: "بوابة دفع", icon: "gateway" },
  { id: "robo", en: "Robo-Advisory", ar: "استشارات آلية", icon: "robo" },
  { id: "api", en: "Open Banking API", ar: "واجهة مصرفية مفتوحة", icon: "api" },
  { id: "crypto", en: "Crypto Custody", ar: "حفظ أصول رقمية", icon: "crypto" }
];

const PRESETS: Preset[] = [
  {
    id: "p1",
    en: "Digital wallet",
    ar: "محفظة رقمية",
    productId: "wallet",
    enText: "A digital wallet that lets users transfer funds between bank accounts, store payment cards, and pay via NFC, with integration into local e-commerce apps.",
    arText: "محفظة رقمية تتيح للمستخدمين تحويل الأموال بين الحسابات البنكية وتخزين بطاقات الدفع، مع إمكانية الدفع عبر NFC وربط مع تطبيقات التسوق الإلكتروني المحلية."
  },
  {
    id: "p2",
    en: "BNPL checkout",
    ar: "دفع آجل",
    productId: "bnpl",
    enText: "A buy-now-pay-later product that splits purchases into 4 interest-free installments, integrated with Saudi e-commerce merchants via an API.",
    arText: "منتج تمويل نقاط البيع (BNPL) يتيح تقسيط المشتريات على 4 دفعات بدون فوائد، ويتكامل مع المتاجر الإلكترونية السعودية عبر واجهة برمجية."
  },
  {
    id: "p3",
    en: "Robo-advisor",
    ar: "استشارات آلية",
    productId: "robo",
    enText: "An automated investment advisory platform that builds portfolios for retail clients based on risk tolerance, with monthly automatic rebalancing.",
    arText: "منصة استشارات استثمارية آلية تقترح محافظ استثمارية للعملاء الأفراد بناءً على تحمل المخاطر، مع إعادة موازنة تلقائية شهرية."
  }
];

const STEP_DEFS: StepDef[] = [
  {
    en: "Extracting product scope",
    ar: "استخراج نطاق المنتج",
    icon: "doc",
    active: { en: "Reading product description...", ar: "قراءة وصف المنتج..." },
    done: { en: "Scope identified", ar: "تحديد النطاق" }
  },
  {
    en: "Searching regulation database",
    ar: "البحث في قاعدة اللوائح",
    icon: "scale",
    active: { en: "Running semantic search...", ar: "بحث دلالي جارٍ..." },
    done: { en: "Relevant articles retrieved", ar: "استرداد المواد ذات الصلة" }
  },
  {
    en: "Analysing compliance requirements",
    ar: "تحليل متطلبات الامتثال",
    icon: "shield",
    active: { en: "Checking requirements...", ar: "فحص الاشتراطات..." },
    done: { en: "Gaps identified", ar: "رصد الثغرات" }
  },
  {
    en: "Compiling findings report",
    ar: "إعداد تقرير النتائج",
    icon: "list",
    active: { en: "Preparing report...", ar: "تجهيز التقرير..." },
    done: { en: "Report ready", ar: "التقرير جاهز" }
  }
];


const CHAT_ERROR_AR = "تعذر الوصول إلى المستشار التنظيمي الآن. تأكد من تشغيل الخادم وحاول مرة أخرى.";
const CHAT_ERROR_EN = "Could not reach the regulatory consultant. Make sure the backend is running and try again.";

const WAIT_STATUS_EN = [
  "Cross-referencing retrieved articles…",
  "Weighing compliance evidence…",
  "Assessing gaps and risk levels…",
  "Drafting findings and recommendations…"
];
const WAIT_STATUS_AR = [
  "مطابقة المواد التنظيمية المسترجعة…",
  "تقييم أدلة الامتثال…",
  "تحديد الثغرات ومستويات المخاطر…",
  "صياغة النتائج والتوصيات…"
];

const CORPUS_DEFS: Array<{ id: Corpus; en: string; ar: string }> = [
  { id: "sama", en: "SAMA", ar: "ساما" },
  { id: "pdpl", en: "PDPL · SDAIA", ar: "حماية البيانات" },
  { id: "shariah", en: "Shariah · AAOIFI", ar: "المعايير الشرعية" },
  { id: "cma", en: "CMA", ar: "هيئة السوق" }
];
const ALL_CORPORA: Corpus[] = ["sama", "pdpl", "shariah", "cma"];

// The 7 dimensions the compliance model checks before deciding whether to ask
// clarifying questions (kept in sync with CLARIFY_SYSTEM in backend/app/llm.py).
// Surfacing them live in the input step teaches users what "good" looks like
// before they ever submit, instead of only reacting after the fact.
type CoverageDim = { id: string; en: string; ar: string; hintEn: string; hintAr: string; keywords: string[] };

const COVERAGE_DIMS: CoverageDim[] = [
  {
    id: "license",
    en: "License status",
    ar: "حالة الترخيص",
    hintEn: "Is the product already SAMA/SOCPA licensed, applying, or pre-application?",
    hintAr: "هل المنتج مرخّص من ساما أو الهيئة، أم قيد التقديم، أم في مرحلة ما قبل التقديم؟",
    keywords: ["licen", "permit", "sama", "socpa", "authoriz", "regulatory approval", "رخص", "ترخيص", "تصريح", "ساما", "موافقة تنظيمية"]
  },
  {
    id: "users",
    en: "Target users",
    ar: "المستخدمون المستهدفون",
    hintEn: "Who will use it? Saudi nationals, residents, SMEs, retail consumers",
    hintAr: "من سيستخدمه؟ مواطنون سعوديون، مقيمون، منشآت صغيرة ومتوسطة، عملاء أفراد؟",
    keywords: ["saudi national", "resident", "sme", "small and medium", "retail consumer", "retail customer", "corporate client", "expatriate", "target user", "target market", "customer segment", "مواطن سعودي", "مقيم", "مؤسسات صغيرة", "عملاء أفراد", "شركات", "مستهدف", "شريحة العملاء"]
  },
  {
    id: "limits",
    en: "Transaction limits",
    ar: "حدود المعاملات",
    hintEn: "Daily/monthly volumes and per-transaction caps",
    hintAr: "الحدود اليومية أو الشهرية وحد كل معاملة",
    keywords: ["limit", "cap", "threshold", "per transaction", "per-transaction", "daily limit", "monthly limit", "maximum amount", "sar ", "حد", "سقف", "الحد الأقصى", "يومي", "شهري", "لكل معاملة", "ريال"]
  },
  {
    id: "data",
    en: "Data handling",
    ar: "التعامل مع البيانات",
    hintEn: "What personal or financial data is collected, stored, or processed",
    hintAr: "ما البيانات الشخصية أو المالية التي تُجمع أو تُخزَّن أو تُعالَج",
    keywords: ["personal data", "data storage", "data collection", "encrypt", "store data", "process data", "pii", "privacy", "data protection", "data retention", "بيانات شخصية", "تخزين البيانات", "جمع البيانات", "تشفير", "خصوصية", "حماية البيانات"]
  },
  {
    id: "integrations",
    en: "Integrations",
    ar: "التكاملات",
    hintEn: "Third-party integrations: banks, SADAD, SARIE, international networks",
    hintAr: "التكاملات مع أطراف ثالثة: البنوك، سداد، سريع، الشبكات الدولية",
    keywords: ["sadad", "sarie", "mada", "bank integration", "api integration", "third-party", "third party", "payment gateway", "network integration", "open banking", "سداد", "سريع", "مدى", "تكامل مع البنوك", "واجهة برمجية", "طرف ثالث", "بوابة الدفع"]
  },
  {
    id: "auth",
    en: "Authentication",
    ar: "المصادقة",
    hintEn: "Authentication method: OTP, biometric, multi-factor, password",
    hintAr: "طريقة المصادقة: رمز تحقق، بصمة، مصادقة ثنائية، كلمة مرور",
    keywords: ["otp", "biometric", "fingerprint", "face id", "face recognition", "multi-factor", "mfa", "two-factor", "authentication method", "pin code", "رمز التحقق", "بصمة", "التعرف على الوجه", "مصادقة ثنائية", "كلمة مرور", "رمز سري"]
  },
  {
    id: "credit",
    en: "Credit / lending",
    ar: "ائتمان أو تمويل",
    hintEn: "Any credit extension, BNPL, or interest-bearing component",
    hintAr: "أي عنصر ائتماني أو تقسيط (BNPL) أو فائدة",
    keywords: ["credit", "loan", "lending", "bnpl", "buy now pay later", "interest rate", "installment", "instalment", "financing", "credit line", "ائتمان", "قرض", "تمويل", "تقسيط", "فائدة", "الدفع الآجل"]
  }
];

function computeCoverage(description: string): boolean[] {
  const lowered = description.toLowerCase();
  return COVERAGE_DIMS.map((dim) => dim.keywords.some((keyword) => lowered.includes(keyword)));
}

const DISCLAIMER_AR = "هذا تقرير تحليلي مبني على وثائق تنظيمية متاحة للعموم ولا يُعدّ رأياً قانونياً نهائياً.";
const DISCLAIMER_EN = "This is an analytical report based on publicly available regulatory documents and does not constitute final legal advice.";

const SAMPLE_EXTRACTED_AR =
  "محفظة رقمية تتيح للمستخدمين تحويل الأموال بين الحسابات البنكية، وتخزين بطاقات الدفع، والدفع عبر NFC في نقاط البيع. " +
  "تتكامل المحفظة مع شبكة مدى ومنصة سداد، وتُوثِّق هوية المستخدم عبر نافذة. " +
  "تعمل المحفظة بموجب ترخيص مزود خدمات الدفع الصادر من مؤسسة النقد العربي السعودي (ساما). " +
  "الحد اليومي للتحويلات 5,000 ريال سعودي، وتُشفَّر بيانات المستخدم وفق معيار AES-256.";
const SAMPLE_EXTRACTED_EN =
  "A digital wallet for Saudi residents enabling fund transfers between bank accounts, card storage, and NFC payments at point of sale. " +
  "Integrated with the Mada network, SADAD bill payment, and Nafath identity verification. " +
  "Operates under a SAMA Payment Services Provider licence. " +
  "Daily transfer limit SAR 5,000. User data encrypted with AES-256 in transit and at rest.";

export default function ComplianceChecker() {
  const [lang, setLang] = useState<Lang>("ar");
  const [mode, setMode] = useState<Mode>("describe");
  const [appState, setAppState] = useState<AppState>("input");
  const [inputText, setInputText] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<Complexity>("executive");
  const [activeStep, setActiveStep] = useState(0);
  const [doneFlags, setDoneFlags] = useState([false, false, false, false]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [dialOffset, setDialOffset] = useState(CIRCUMFERENCE);
  const [dialDisplay, setDialDisplay] = useState(0);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInputValue, setChatInputValue] = useState("");
  const [chatTyping, setChatTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string[]>>({});
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [submittedDesc, setSubmittedDesc] = useState("");
  const [uploadExtractedText, setUploadExtractedText] = useState("");
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [scanSeconds, setScanSeconds] = useState(0);
  const [waitMsgIdx, setWaitMsgIdx] = useState(0);
  const [selectedCorpora, setSelectedCorpora] = useState<Corpus[]>(ALL_CORPORA);
  const [liveFindings, setLiveFindings] = useState<Finding[]>([]);
  const [retrievedArticles, setRetrievedArticles] = useState<RetrievedArticle[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [clarifiedCount, setClarifiedCount] = useState(0);
  const [scanDate, setScanDate] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const rafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const isAr = lang === "ar";
  const dirAttr = isAr ? "rtl" : "ltr";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const hasStarted = appState === "scanning" || appState === "results";
  const isResults = appState === "results";
  const canScan = hasContent();
  const productName = selectedProduct
    ? t(
        PRODUCT_TYPES.find((product) => product.id === selectedProduct)?.en ?? "General financial product",
        PRODUCT_TYPES.find((product) => product.id === selectedProduct)?.ar ?? "منتج مالي عام"
      )
    : t("General financial product", "منتج مالي عام");

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirAttr;
  }, [dirAttr, lang]);

  useEffect(() => {
    // Live backend badge in the topbar (audit A-2): poll /health so judges
    // can see the system is real — and so a dead backend is visible instantly.
    let cancelled = false;
    const load = () => fetchHealth().then((info) => { if (!cancelled) setHealth(info); });
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function clearTimers() {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
    intervals.current.forEach((interval) => clearInterval(interval));
    intervals.current = [];
  }

  function animateScrollTo(target: number, duration: number) {
    const container = scrollRef.current;
    if (!container) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    const start = container.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      container.scrollTop = target;
      return;
    }
    const started = performance.now();
    const ease = (progress: number) => (progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      container.scrollTop = start + distance * ease(progress);
      if (progress < 1) scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
  }

  function scrollToId(id: string) {
    const container = scrollRef.current;
    if (!container) return;
    const element = container.querySelector<HTMLElement>(`#${id}`);
    if (!element) return;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const target = container.scrollTop + elementRect.top - containerRect.top - 6;
    animateScrollTo(target, 760);
  }

  function hasContent() {
    if (mode === "describe") {
      if (uploadExtracting) return false;
      return inputText.trim().length > 0 || uploadExtractedText.trim().length > 0;
    }
    if (mode === "voice") return transcript.trim().length > 0;
    return false;
  }

  function effectiveDesc() {
    if (mode === "voice") return transcript;
    const text = inputText.trim();
    const doc = uploadExtractedText.trim();
    if (text && doc) {
      const label = isAr ? "[محتوى المستند المرفق]" : "[Attached document content]";
      return `${text}\n\n${label}\n${doc}`;
    }
    return doc || inputText;
  }

  function applyPreset(preset: Preset) {
    setMode("describe");
    setInputText(isAr ? preset.arText : preset.enText);
    setSelectedProduct(preset.productId);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const meta = file.size >= 1_048_576
      ? `${(file.size / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    setUploadedFile({ name: file.name, meta });
    setUploadExtractedText("");
    setUploadError(null);

    const ext = file.name.toLowerCase().split(".").pop() ?? "";

    if (ext === "txt") {
      setUploadExtracting(true);
      try {
        const text = await file.text();
        if (!text.trim()) throw new Error("empty");
        setUploadExtractedText(text.trim().slice(0, 8000));
      } catch {
        setUploadError(t("Could not read the file", "تعذر قراءة الملف"));
      } finally {
        setUploadExtracting(false);
      }
      return;
    }

    if (!["pdf", "docx", "doc"].includes(ext)) {
      setUploadError(t("Unsupported file type. Use PDF, DOCX, or TXT.", "نوع الملف غير مدعوم. استخدم PDF أو DOCX أو TXT."));
      return;
    }

    setUploadExtracting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setUploadExtractedText(data.text);
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadError(
          err.detail ?? t("Failed to read file", "تعذر قراءة الملف")
        );
      }
    } catch {
      setUploadError(t("Could not reach the server to read the file", "تعذر الوصول إلى الخادم لقراءة الملف"));
    } finally {
      setUploadExtracting(false);
    }
  }

  function useSampleFile() {
    setUploadedFile({ name: "Product-Spec-DigitalWallet.pdf", meta: isAr ? "4 صفحات · 312 KB" : "4 pages · 312 KB" });
    setUploadExtractedText(isAr ? SAMPLE_EXTRACTED_AR : SAMPLE_EXTRACTED_EN);
    setUploadError(null);
  }

  function toggleRecord() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) {
      setVoiceError(
        isAr
          ? "المتصفح لا يدعم التعرف على الصوت. استخدم Chrome أو Edge."
          : "Voice recognition is not supported in this browser. Please use Chrome or Edge."
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechAPI();
    recognition.lang = isAr ? "ar-SA" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let final = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += chunk;
        } else {
          interim += chunk;
        }
      }
      setTranscript((final + interim).trim());
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        const msg =
          event.error === "not-allowed"
            ? t("Microphone permission was denied", "لم يُمنح إذن الميكروفون")
            : t("Voice recognition error. Please try again.", "حدث خطأ في التعرف على الصوت. حاول مرة أخرى.");
        setVoiceError(msg);
      }
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    setRecording(true);
    setTranscript("");
    setVoiceError(null);
    final = "";
    recognition.start();
  }

  async function startScan() {
    if (!canScan) return;
    clearTimers();
    setScanError(null);
    setComplianceResult(null);
    setClarifyQuestions([]);
    setClarifyAnswers({});
    setClarifiedCount(0);
    setClarifyLoading(true);
    setAppState("clarifying");
    const scrollTimer = setTimeout(() => scrollToId("clarify"), 80);
    timers.current.push(scrollTimer);

    const productType: BackendProductType = selectedProduct ? (PRODUCT_TYPE_MAP[selectedProduct] ?? "general") : "general";
    const { questions } = await getProductQuestions(effectiveDesc(), productType, lang);
    setClarifyLoading(false);

    if (questions.length === 0) {
      runActualScan(effectiveDesc());
    } else {
      setClarifyQuestions(questions);
    }
  }

  function runActualScan(desc: string) {
    setSubmittedDesc(desc);
    setAppState("scanning");
    setActiveStep(0);
    setDoneFlags([false, false, false, false]);
    setRevealedCount(0);
    setScanSeconds(0);
    setWaitMsgIdx(0);
    setLiveFindings([]);
    setRetrievedArticles([]);
    const scrollTimer = setTimeout(() => scrollToId("scan"), 80);
    timers.current.push(scrollTimer);

    intervals.current.push(setInterval(() => setScanSeconds((s) => s + 1), 1000));
    intervals.current.push(setInterval(() => setWaitMsgIdx((i) => i + 1), 4500));

    const productType: BackendProductType = selectedProduct ? (PRODUCT_TYPE_MAP[selectedProduct] ?? "general") : "general";

    const onScanError = () => {
      clearTimers();
      setScanError(isAr ? "تعذر الاتصال بالخادم. تأكد من تشغيل الواجهة الخلفية." : "Could not reach the backend. Make sure it is running.");
      setAppState("input");
    };

    // Streaming first (real retrieval + findings fill the slots as Claude
    // writes them); the plain POST /api/check path is the fallback.
    streamCheck(desc, productType, complexity, lang, selectedCorpora, {
      onRetrieved: (articles) => setRetrievedArticles(articles.slice(0, 8)),
      onFinding: (finding) => setLiveFindings((current) => [...current, finding])
    })
      .then((result) => {
        setDoneFlags([true, true, true, true]);
        finishScan(result);
      })
      .catch(() => {
        checkCompliance(desc, productType, complexity, lang, selectedCorpora)
          .then((result) => {
            setDoneFlags([true, true, true, true]);
            finishScan(result);
          })
          .catch(onScanError);
      });

    // Steps 1-3 animate on timers; step 4 stays active until the real
    // API result arrives, so the UI never claims a report that isn't ready.
    const stepDuration = 950;
    for (let index = 0; index < 3; index += 1) {
      const timer = setTimeout(() => {
        setDoneFlags((current) => {
          const next = [...current];
          next[index] = true;
          return next;
        });
        setActiveStep(index + 1);
      }, stepDuration * (index + 1));
      timers.current.push(timer);
    }

    for (let index = 1; index <= 6; index += 1) {
      const revealTimer = setTimeout(() => setRevealedCount(index), 280 * index + 150);
      timers.current.push(revealTimer);
    }
  }

  function buildAugmentedDescription() {
    const answered = clarifyQuestions.filter(q => (clarifyAnswers[q.id] ?? []).length > 0);
    if (answered.length === 0) return effectiveDesc();
    const header = isAr ? "\n\n[تفاصيل إضافية يقدمها المستخدم]\n" : "\n\n[Additional details provided by user]\n";
    const lines = answered.map(q => {
      const selectedVals = clarifyAnswers[q.id] ?? [];
      const selectedLabels = q.options
        .filter(o => selectedVals.includes(o.value))
        .map(o => isAr ? o.label_ar : o.label_en);
      return `- ${isAr ? q.text_ar : q.text_en}: ${selectedLabels.join(", ")}`;
    });
    return effectiveDesc() + header + lines.join("\n");
  }

  function toggleClarifyAnswer(questionId: string, value: string, allowMultiple: boolean) {
    setClarifyAnswers(prev => {
      const current = prev[questionId] ?? [];
      if (allowMultiple) {
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: current.includes(value) ? [] : [value] };
    });
  }

  function submitClarifications() {
    setClarifiedCount(Object.values(clarifyAnswers).filter((values) => values.length > 0).length);
    runActualScan(buildAugmentedDescription());
  }

  function toggleCorpus(corpus: Corpus) {
    setSelectedCorpora((current) => {
      if (current.includes(corpus)) {
        const next = current.filter((c) => c !== corpus);
        return next.length > 0 ? next : current; // keep at least one selected
      }
      return [...current, corpus];
    });
  }

  function finishScan(result: ComplianceResult) {
    clearTimers();
    const ref = `CX-2026-${Math.floor(10000 + Math.random() * 89999)}`;
    // Fill slots with real finding data immediately so user can read them
    setComplianceResult(result);
    setRevealedCount(6);
    setScanDate(new Date().toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short", year: "numeric" }));
    fetchHealth().then(setHealth);
    // Hold on the scan view for 2.5s so the real articles are readable, then transition
    const transitionTimer = setTimeout(() => {
      setAppState("results");
      setRefNumber(ref);
      setDialOffset(CIRCUMFERENCE);
      setDialDisplay(0);
      const scrollTimer = setTimeout(() => scrollToId("report"), 90);
      timers.current.push(scrollTimer);
      const target = CIRCUMFERENCE * (1 - result.compliance_score / 100);
      const finalScore = result.compliance_score;
      const dialTimer = setTimeout(() => {
        setDialOffset(target);
        startCountUp(finalScore);
      }, 450);
      timers.current.push(dialTimer);
    }, 2500);
    timers.current.push(transitionTimer);
  }

  function startCountUp(targetScore: number) {
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDialDisplay(Math.round(eased * targetScore));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function resetToInput() {
    clearTimers();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAppState("input");
    setActiveStep(0);
    setDoneFlags([false, false, false, false]);
    setRevealedCount(0);
    setDialOffset(CIRCUMFERENCE);
    setDialDisplay(0);
    setExpandedFindingId(null);
    setComplianceResult(null);
    setScanError(null);
    setClarifyQuestions([]);
    setClarifyAnswers({});
    setClarifyLoading(false);
    setSubmittedDesc("");
    setLiveFindings([]);
    setRetrievedArticles([]);
    setClarifiedCount(0);
    recognitionRef.current?.stop();
    setRecording(false);
    setVoiceError(null);
    const timer = setTimeout(() => scrollToId("input"), 80);
    timers.current.push(timer);
  }

  async function handleComplexityChange(newComplexity: Complexity) {
    setComplexity(newComplexity);
    if (!complianceResult) return;
    const productType: BackendProductType = selectedProduct ? (PRODUCT_TYPE_MAP[selectedProduct] ?? "general") : "general";
    setIsRefetching(true);
    try {
      // Re-render existing findings in the new tone — never re-classifies,
      // so compliance_score is guaranteed identical to the original scan.
      const result = await retoneReport(complianceResult.findings, productType, newComplexity, lang);
      setComplianceResult(result);
      const target = CIRCUMFERENCE * (1 - result.compliance_score / 100);
      setDialOffset(target);
      setDialDisplay(result.compliance_score);
    } catch {
      // keep existing result on error
    } finally {
      setIsRefetching(false);
    }
  }

  async function handleLangChange(newLang: Lang) {
    setLang(newLang);
    if (!complianceResult || isRefetching) return;
    const productType: BackendProductType = selectedProduct ? (PRODUCT_TYPE_MAP[selectedProduct] ?? "general") : "general";
    setIsRefetching(true);
    try {
      // Re-render existing findings in the new language — never re-classifies,
      // so compliance_score is guaranteed identical to the original scan.
      const result = await retoneReport(complianceResult.findings, productType, complexity, newLang);
      setComplianceResult(result);
      const target = CIRCUMFERENCE * (1 - result.compliance_score / 100);
      setDialOffset(target);
      setDialDisplay(result.compliance_score);
    } catch {
      // keep existing result on error
    } finally {
      setIsRefetching(false);
    }
  }

  async function sendChat() {
    const text = chatInputValue.trim();
    if (!text || chatTyping) return;
    const userMessage = { id: Date.now(), fromUser: true, text };
    const history = [...chatMessages, userMessage].map((message) => ({
      role: message.fromUser ? ("user" as const) : ("assistant" as const),
      content: message.text
    }));
    setChatMessages((current) => [...current, userMessage]);
    setChatInputValue("");
    setChatTyping(true);
    try {
      const response = await askConsultant(text, history);
      setChatMessages((current) => [...current, { id: Date.now() + 1, fromUser: false, text: response.answer }]);
    } catch {
      setChatMessages((current) => [...current, { id: Date.now() + 1, fromUser: false, text: isAr ? CHAT_ERROR_AR : CHAT_ERROR_EN }]);
    } finally {
      setChatTyping(false);
    }
  }

  function onChatKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") sendChat();
  }

  function downloadReport() {
    if (!complianceResult) return;
    const recLabel = isAr ? "التوصية" : "Recommendation";
    const analysisLabel = isAr ? "التحليل" : "Analysis";
    const sourceLabel = isAr ? "المصدر" : "Source";
    const articleTextLabel = isAr ? "نص المادة" : "Article Text";
    const lines = [
      isAr ? "ComplyX - تقرير فحص الامتثال" : "ComplyX - Compliance Report",
      `Ref: ${refNumber}   Score: ${complianceResult.compliance_score}/100   Risk: ${complianceResult.risk_level.toUpperCase()}`,
      `${isAr ? "مستوى الشرح" : "Detail level"}: ${complexity}`,
      "",
      complianceResult.executive_summary,
      "",
      ...complianceResult.findings.flatMap((finding, idx) => {
        const num = `F-${String(idx + 1).padStart(2, "0")}`;
        const rows: string[] = [
          `${num} [${finding.status.toUpperCase()}] ${finding.requirement.article}: ${finding.requirement.title}`,
          `${sourceLabel}: ${finding.requirement.source}`,
        ];
        if (finding.requirement.text) {
          rows.push(`${articleTextLabel}:`);
          rows.push(finding.requirement.text);
        }
        rows.push(`${analysisLabel}: ${finding.analysis}`);
        rows.push(`${recLabel}: ${finding.recommendation}`);
        rows.push("");
        return rows;
      }),
      isAr ? DISCLAIMER_AR : DISCLAIMER_EN
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ComplyX-Report.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const traits = [
    {
      key: "match",
      title: t("Instant regulatory matching", "مطابقة فورية مع اللوائح"),
      body: t("Every claim cross-checked against live KSA financial regulations.", "يُقارَن وصف منتجك باللوائح المالية السعودية لحظياً."),
      icon: "match"
    },
    {
      key: "cite",
      title: t("Verbatim article citations", "اقتباسات حرفية من المواد"),
      body: t("Every finding quotes the exact regulation text it is based on. No paraphrasing, no invented articles.", "كل نتيجة تقتبس النص التنظيمي الحرفي الذي استندت إليه، دون إعادة صياغة أو مواد مختلقة."),
      icon: "cite"
    },
    {
      key: "coverage",
      title: t("Full regulatory coverage", "تغطية تنظيمية شاملة"),
      body: t("SAMA, SDAIA data protection, AAOIFI Shariah and CMA standards. Over 9,000 indexed articles in one scan.", "ساما وحماية البيانات والمعايير الشرعية وهيئة السوق المالية. أكثر من 9,000 مادة مفهرسة في فحص واحد."),
      icon: "coverage"
    }
  ];

  const modeDefs: Array<{ id: Mode; label: string }> = [
    { id: "describe", label: t("Describe or upload", "اكتب أو ارفع مستنداً") },
    { id: "voice", label: t("Voice", "تسجيل صوتي") }
  ];

  const complexityDefs: Array<{ id: Complexity; label: string; caption: string }> = [
    { id: "simple", label: t("Simple", "مبسّط"), caption: t("Everyday language, no jargon", "لغة يومية بدون مصطلحات") },
    { id: "executive", label: t("Executive", "تنفيذي"), caption: t("Business impact & decisions", "التركيز على الأثر والقرار") },
    { id: "technical", label: t("Technical", "تقني"), caption: t("Regulatory & technical depth", "تفاصيل نظامية وتقنية") }
  ];

  const currentComplexityCaption = complexityDefs.find((item) => item.id === complexity)?.caption ?? complexityDefs[1].caption;
  const score = complianceResult?.compliance_score ?? 0;
  const risk = complianceResult?.risk_level ?? "high";
  const dialColor = score >= 82 ? "#147a5b" : score >= 58 ? "#a15c09" : "#b42318";
  const riskColor = risk === "high" ? "#b42318" : risk === "medium" ? "#a15c09" : "#147a5b";
  const riskValueLabel = risk === "high" ? t("High", "مرتفع") : risk === "medium" ? t("Medium", "متوسط") : t("Low", "منخفض");
  const gapCount = complianceResult?.gaps_count ?? 0;
  const reviewCount = complianceResult?.findings.filter((f) => f.status === "needs_review").length ?? 0;
  const rc = Math.min(revealedCount, 6);
  const nextSlot = appState === "scanning" && rc < 6 ? rc : -1;
  // Slot sources, in priority order: final result findings → findings
  // streamed so far → retrieved article titles → shimmer placeholders.
  const slotCount = complianceResult
    ? complianceResult.findings.length
    : Math.max(retrievedArticles.length > 0 ? Math.min(retrievedArticles.length, 8) : 6, liveFindings.length);
  const displayCount = complianceResult ? complianceResult.findings.length : liveFindings.length;
  const sectionSlots = Array.from({ length: slotCount }, (_, slotIndex) => {
    const finding = complianceResult?.findings[slotIndex] ?? liveFindings[slotIndex] ?? null;
    const retrieved = !finding ? retrievedArticles[slotIndex] ?? null : null;
    const scanFilled = !complianceResult && !finding && !retrieved && slotIndex < rc;
    const dot = finding
      ? finding.status === "gap" ? "#ff9a8f" : finding.status === "needs_review" ? "#f3d08a" : "#8fe8df"
      : "#8fe8df";
    const halo = finding
      ? finding.status === "gap" ? "rgba(255,154,143,0.2)" : finding.status === "needs_review" ? "rgba(243,208,138,0.2)" : "rgba(143,232,223,0.2)"
      : "rgba(143,232,223,0.2)";
    return { finding, retrieved, scanFilled, isNext: slotIndex === nextSlot, dot, halo };
  });

  const coverageFlags = computeCoverage(effectiveDesc());
  const coverageCovered = coverageFlags.filter(Boolean).length;

  return (
    <div className="cx-root">
      <header className="cx-topbar" dir="ltr">
        <div className="cx-brand">
          <LogoMark />
          <div className="cx-brand-copy">
            <span className="cx-brand-name">ComplyX</span>
            <span className="cx-brand-sub">COMPLIANCE AI</span>
          </div>
        </div>
        <div className="cx-topbar-actions">
          <div className={`cx-status-pill${health && !health.ready ? " is-off" : ""}`}>
            <span />
            {health === null
              ? t("Connecting…", "جارٍ الاتصال…")
              : health.ready
                ? `${t("KSA Regs · Live", "اللوائح السعودية · محدّث")} · ${health.indexed_articles.toLocaleString()}`
                : t("Backend offline", "الخادم غير متصل")}
          </div>
          <div className="cx-lang-toggle">
            <div className={`cx-lang-indicator${isAr ? " is-ar" : ""}`} />
            <button className={`cx-lang-btn${!isAr ? " is-active" : ""}`} disabled={isRefetching} onClick={() => handleLangChange("en")} type="button">
              EN
            </button>
            <button className={`cx-lang-btn${isAr ? " is-active" : ""}`} disabled={isRefetching} onClick={() => handleLangChange("ar")} type="button">
              AR
            </button>
          </div>
        </div>
      </header>

      <div className="cx-scroll" dir="ltr" ref={scrollRef}>
        <div dir={dirAttr}>
          <section className="cx-hero" data-screen-label="Hero" id="hero">
            <div className="cx-hero-grid">
              <div className="cx-hero-visual" aria-hidden="true">
                <div className="cx-shield-orbit" />
                <ShieldHero />
              </div>
              <div className="cx-hero-copy">
                <h1 className="cx-hero-title">{t("Automated Financial Compliance. Continuous Audit Readiness.", "امتثال مالي آلي. استعداد دائم للتدقيق.")}</h1>
                <p className="cx-hero-subtitle">
                  {t(
                    "Describe your product or upload its document. Our AI agent checks it against KSA financial regulations in seconds.",
                    "صِف منتجك أو ارفع مستنده، ليطابقه الذكاء الاصطناعي مع اللوائح المالية السعودية خلال ثوانٍ."
                  )}
                </p>
                <button className="cx-hero-cta" onClick={() => scrollToId("input")} type="button">
                  {t("Start a scan", "ابدأ الفحص")}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c2a2f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="cx-trait-grid">
              {traits.map((trait) => (
                <article className="cx-trait-card" key={trait.key}>
                  <div className="cx-trait-icon">
                    <TraitIcon icon={trait.icon} />
                  </div>
                  <h3>{trait.title}</h3>
                  <p>{trait.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="cx-input-section" data-screen-label="Input" id="input">
            <div className="cx-input-bg" aria-hidden="true">
              <div className="cx-input-orb one" />
              <div className="cx-input-orb two" />
              <div className="cx-input-grid-mask" />
            </div>
            <div className="cx-input-shell">
              <div className="cx-input-heading">
                <div className="cx-input-kicker">{t("STEP 1 · INPUT", "الخطوة 1 · الإدخال")}</div>
                <h2>{t("Tell us about your product", "عرِّفنا بمنتجك")}</h2>
                <p>{t("Choose how you want to submit it.", "اختر طريقة تقديم منتجك للفحص.")}</p>
              </div>

              <div className="cx-mode-switch">
                {modeDefs.map((item) => (
                  <button className={`cx-mode-btn${mode === item.id ? " is-active" : ""}`} key={item.id} onClick={() => setMode(item.id)} type="button">
                    <ModeIcon mode={item.id} />
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="cx-input-card">
                {mode === "describe" && (
                  <div className="cx-describe-panel">
                    <div className="cx-corpora-row">
                      <span className="cx-section-label">{t("Check against", "الفحص مقابل")}</span>
                      <div className="cx-corpora-chips">
                        {CORPUS_DEFS.map((corpus) => {
                          const active = selectedCorpora.includes(corpus.id);
                          const count = health?.corpora?.[corpus.id] ?? 0;
                          const disabled = health !== null && health.ready && count === 0;
                          return (
                            <button
                              className={`cx-corpus-chip${active ? " is-active" : ""}`}
                              disabled={disabled}
                              key={corpus.id}
                              onClick={() => toggleCorpus(corpus.id)}
                              title={disabled ? t("No articles indexed for this regulator yet", "لا توجد مواد مفهرسة لهذه الجهة بعد") : undefined}
                              type="button"
                            >
                              {active ? <CheckSmall /> : null}
                              {isAr ? corpus.ar : corpus.en}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="cx-section-label">{t("Product Type", "نوع المنتج")}</div>
                    <div className="cx-product-grid">
                      {PRODUCT_TYPES.map((product) => {
                        const active = selectedProduct === product.id;
                        return (
                          <button className={`cx-product-card${active ? " is-active" : ""}`} key={product.id} onClick={() => setSelectedProduct(product.id)} type="button">
                            <ProductIcon icon={product.icon} />
                            <div className="cx-product-label">{isAr ? product.ar : product.en}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="cx-textarea-wrap">
                      <textarea
                        className="cx-textarea"
                        maxLength={4000}
                        onChange={(event) => setInputText(event.target.value)}
                        placeholder={t(
                          "Describe the financial product you plan to launch in Saudi Arabia: features, target users, payment flows, data handling...",
                          "صف المنتج المالي الذي تخطط لإطلاقه في السعودية: الميزات، المستخدمين المستهدفين، تدفقات الدفع، طريقة التعامل مع البيانات..."
                        )}
                        value={inputText}
                      />
                      <div className="cx-char-count">{inputText.length} / 4000</div>
                    </div>
                    <div className="cx-attach-row">
                      {uploadedFile ? (
                        <div className="cx-attach-chip">
                          <span className="cx-attach-chip-icon">
                            <UploadMini />
                          </span>
                          <div className="cx-attach-chip-copy">
                            <strong>{uploadedFile.name}</strong>
                            {uploadExtracting ? (
                              <em style={{ color: "var(--teal-700)" }}>
                                <span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(0,107,104,0.2)", borderTopColor: "var(--teal-700)", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                                {t("Extracting text...", "جارٍ استخراج النص...")}
                              </em>
                            ) : uploadError ? (
                              <em style={{ color: "var(--danger)" }}>{uploadError}</em>
                            ) : uploadExtractedText ? (
                              <em>
                                <CheckMini />
                                {t("Ready to scan", "جاهز للفحص")}
                              </em>
                            ) : null}
                          </div>
                          <button className="cx-remove-file" onClick={() => { setUploadedFile(null); setUploadExtractedText(""); setUploadError(null); }} type="button" aria-label={t("Remove file", "إزالة الملف")}>
                            <CloseMini />
                          </button>
                        </div>
                      ) : (
                        <>
                          <label className="cx-attach-btn">
                            <input accept=".pdf,.docx,.doc,.txt" onChange={onFileChange} type="file" />
                            <UploadMini />
                            {t("Attach a document", "أرفق مستنداً")}
                            <span>{t("PDF, DOCX or TXT · 20 MB", "PDF أو DOCX أو TXT · 20 م.ب")}</span>
                          </label>
                          <span className="cx-sample-file" style={{ marginTop: 0 }}>
                            {t("or", "أو")}{" "}
                            <button onClick={useSampleFile} type="button">
                              {t("use a sample document", "استخدم مستنداً تجريبياً")}
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="cx-presets">
                      <span>{t("Try an example:", "جرّب مثالاً:")}</span>
                      {PRESETS.map((preset) => (
                        <button className="cx-preset-link" key={preset.id} onClick={(e) => { applyPreset(preset); (e.currentTarget as HTMLButtonElement).blur(); }} type="button">
                          {isAr ? preset.ar : preset.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "voice" && (
                  <div className="cx-voice-panel">
                    <div className="cx-mic-wrap">
                      {recording && (
                        <>
                          <div className="cx-mic-pulse" />
                          <div className="cx-mic-pulse delay" />
                        </>
                      )}
                      <button className={`cx-mic-btn${recording ? " is-recording" : ""}`} onClick={toggleRecord} type="button">
                        {recording ? <span className="cx-stop-icon" /> : <MicMini />}
                      </button>
                    </div>
                    <div className="cx-wave-bars">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                        <span className={recording ? "is-recording" : ""} key={item} style={{ animationDelay: `${item * 0.09}s` }} />
                      ))}
                    </div>
                    <div className={`cx-voice-status${recording ? " is-recording" : transcript ? " is-done" : ""}`}>
                      {recording
                        ? t("Listening... tap to stop", "يستمع... انقر للإيقاف")
                        : transcript
                          ? t("Transcribed", "تم التفريغ")
                          : t("Tap the mic and describe your product", "انقر الميكروفون وابدأ وصف منتجك")}
                    </div>
                    {voiceError && (
                      <div className="cx-voice-error" role="alert">
                        {voiceError}
                      </div>
                    )}
                    {transcript && (
                      <div className="cx-transcript-box">
                        <div>
                          <AudioMini />
                          {t("TRANSCRIPT", "النص المُفرّغ")}
                        </div>
                        <p>{transcript}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="cx-coverage">
                  <div className="cx-coverage-head">
                    <span className="cx-section-label">{t("What makes a strong description", "ما الذي يجعل الوصف قوياً")}</span>
                    <strong>{coverageCovered} / {COVERAGE_DIMS.length}</strong>
                  </div>
                  <p className="cx-coverage-caption">
                    {t(
                      "Mention these and the scan needs fewer follow-up questions.",
                      "اذكر هذه التفاصيل ليحتاج الفحص أسئلة توضيحية أقل."
                    )}
                  </p>
                  <div className="cx-coverage-chips">
                    {COVERAGE_DIMS.map((dim, index) => {
                      const covered = coverageFlags[index];
                      return (
                        <div
                          className={`cx-coverage-chip${covered ? " is-covered" : ""}`}
                          key={dim.id}
                          title={isAr ? dim.hintAr : dim.hintEn}
                        >
                          {covered ? <CheckSmall /> : null}
                          {isAr ? dim.ar : dim.en}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button className={`cx-cta${canScan ? " is-enabled" : ""}`} disabled={!canScan} onClick={startScan} type="button">
                  <SearchMini />
                  {t("Run Compliance Scan", "ابدأ فحص الامتثال")}
                </button>
                {!canScan && (
                  <p className="cx-cta-hint">
                    {mode === "describe"
                      ? t("Describe your product or attach its document to enable the scan", "اكتب وصف منتجك أو أرفق مستنده لتفعيل الفحص")
                      : t("Record a voice description to enable the scan", "سجّل وصفاً صوتياً لتفعيل الفحص")}
                  </p>
                )}
              </div>
            </div>
          </section>

          {(appState === "clarifying" || (hasStarted && clarifyQuestions.length > 0 && clarifiedCount > 0)) && (
            <section className="cx-clarify-section" data-screen-label="Clarify" id="clarify">
              <div className="cx-input-bg" aria-hidden="true">
                <div className="cx-input-orb one" />
                <div className="cx-input-orb two" />
                <div className="cx-input-grid-mask" />
              </div>
              <div className="cx-clarify-shell">
                <div className="cx-input-heading">
                  <div className="cx-input-kicker">{t("STEP 1.5 · PRODUCT DETAILS", "الخطوة 1.5 · تفاصيل المنتج")}</div>
                  {hasStarted ? (
                    <>
                      <h2>{t("Your product details", "تفاصيل منتجك")}</h2>
                      <p>{t("The answers you selected were included in the scan. Findings based on them are marked in the report.", "أُدرجت إجاباتك المحددة في الفحص، والنتائج المبنية عليها مُعلَّمة في التقرير.")}</p>
                    </>
                  ) : (
                    <>
                      <h2>{t("Help us understand your product", "ساعدنا على فهم منتجك بشكل أدق")}</h2>
                      <p>{t("Select the options that best describe your product for a more accurate compliance report.", "اختر الخيارات التي تصف منتجك للحصول على تقرير امتثال أكثر دقة.")}</p>
                    </>
                  )}
                </div>

                {clarifyLoading && !hasStarted ? (
                  <div className="cx-clarify-loading">
                    <span className="cx-spinner" style={{ width: 22, height: 22, borderColor: "rgba(0,107,104,0.25)", borderTopColor: "var(--teal-700)" }} />
                    {t("Analysing your description...", "جارٍ تحليل الوصف...")}
                  </div>
                ) : (
                  <div className={`cx-clarify-card${hasStarted ? " is-recap" : ""}`}>
                    {clarifyQuestions.map((question, qi) => (
                      <div className="cx-clarify-question" key={question.id}>
                        <div className="cx-clarify-q-label">
                          <span>{qi + 1}</span>
                          {isAr ? question.text_ar : question.text_en}
                        </div>
                        <div className="cx-clarify-chips">
                          {question.options.map(option => {
                            const selected = (clarifyAnswers[question.id] ?? []).includes(option.value);
                            return (
                              <button
                                className={`cx-clarify-chip${selected ? " is-active" : ""}`}
                                disabled={hasStarted}
                                key={option.value}
                                onClick={() => toggleClarifyAnswer(question.id, option.value, question.allow_multiple)}
                                type="button"
                              >
                                {selected && <CheckSmall />}
                                {isAr ? option.label_ar : option.label_en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {!hasStarted && (
                      <div className="cx-clarify-actions">
                        <button className="cx-cta is-enabled" onClick={submitClarifications} style={{ marginTop: 0 }} type="button">
                          <SearchMini />
                          {t("Continue to Compliance Scan", "متابعة فحص الامتثال")}
                        </button>
                        <button className="cx-clarify-skip" onClick={() => runActualScan(effectiveDesc())} type="button">
                          {t("Skip, use my description as-is", "تخطَّ وابدأ الفحص بالوصف الحالي")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {hasStarted && (
            <section className="cx-scan-section" data-screen-label="Scanning" id="scan">
              <div className="cx-scan-radar" aria-hidden="true">
                <div className="cx-scan-ring r1" />
                <div className="cx-scan-ring r2" />
                <div className="cx-scan-ring r3" />
                <div className="cx-scan-sweep">
                  <span />
                </div>
              </div>
              <div className="cx-scan-head">
                <div>{t("STEP 2 · ANALYSIS", "الخطوة 2 · التحليل")}</div>
                <h2>{t("The agent is inspecting your product", "الذكاء الاصطناعي يفحص منتجك الآن")}</h2>
              </div>

              <div className="cx-scan-shell">
                <div className="cx-submitted-strip">
                  <span>{t("Submitted product", "المنتج المُقدَّم")}</span>
                  <i />
                  <strong>{productName}</strong>
                  {uploadedFile && mode === "describe" && (
                    <em className="cx-strip-file" title={uploadedFile.name}>
                      <UploadMini />
                      {uploadedFile.name}
                    </em>
                  )}
                  <p dir={dirAttr}>{(submittedDesc || effectiveDesc()).replace(/\s+/g, " ").trim()}</p>
                  <em>{complexityDefs.find((item) => item.id === complexity)?.label}</em>
                </div>

                <div className="cx-scan-grid">
                  <div className="cx-journey-card">
                    <div className="cx-journey-kicker">
                      {appState === "scanning" && <span />}
                      {t("Analysis journey", "مسار التحليل")}
                    </div>
                    <div className="cx-journey-list">
                      {STEP_DEFS.map((step, index) => {
                        const done = doneFlags[index];
                        const active = !done && activeStep === index && appState === "scanning";
                        const pending = !done && !active;
                        const waitPool = isAr ? WAIT_STATUS_AR : WAIT_STATUS_EN;
                        const activeSub =
                          index === 3
                            ? `${waitPool[waitMsgIdx % waitPool.length]} ${scanSeconds}${t("s", " ث")}`
                            : isAr ? step.active.ar : step.active.en;
                        return (
                          <div className="cx-step-row" key={step.en}>
                            <div className="cx-step-node-col">
                              <div className="cx-step-node-wrap">
                                {active && <div className="cx-pulse-ring" />}
                                <div className={`cx-step-node${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
                                  {done && <CheckLarge />}
                                  {active && <span className="cx-spinner" />}
                                  {pending && <StepIcon icon={step.icon} />}
                                </div>
                              </div>
                              {index < STEP_DEFS.length - 1 && (
                                <div className="cx-connector">
                                  <div className={done ? "is-filled" : ""} />
                                </div>
                              )}
                            </div>
                            <div className="cx-step-copy">
                              <div className={`cx-step-label${active ? " is-current" : ""}${done ? " is-done" : ""}`}>{isAr ? step.ar : step.en}</div>
                              <div className={`cx-step-sub${active && index === 3 ? " is-wait" : ""}`} key={active ? activeSub : done ? "done" : "pending"}>
                                {active ? activeSub : done ? (isAr ? step.done.ar : step.done.en) : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cx-section-discovery">
                    <div className="cx-section-discovery-head">
                      <span>{t("Relevant regulations", "اللوائح ذات الصلة")}</span>
                      <strong>
                        {displayCount} / {slotCount}
                      </strong>
                    </div>
                    <div className="cx-section-slots">
                      {sectionSlots.map((slot, index) => (
                        <div className={`cx-section-slot${(slot.finding || slot.retrieved || slot.scanFilled) ? " is-filled" : ""}${slot.isNext ? " is-next" : ""}`} key={index}>
                          {slot.finding ? (
                            <div className="cx-slot-content">
                              <div>
                                <span>
                                  {slot.finding.requirement.regulator ? `${slot.finding.requirement.regulator} · ` : ""}
                                  {slot.finding.requirement.article}
                                </span>
                                <i style={{ background: slot.dot, boxShadow: `0 0 0 4px ${slot.halo}` }} />
                              </div>
                              <strong dir="auto">{slot.finding.requirement.title}</strong>
                            </div>
                          ) : slot.retrieved ? (
                            <div className="cx-slot-content is-retrieved">
                              <div>
                                <span>
                                  {slot.retrieved.regulator ? `${slot.retrieved.regulator} · ` : ""}
                                  {slot.retrieved.article}
                                </span>
                                <i className="cx-slot-scan-dot" />
                              </div>
                              <strong dir="auto">{slot.retrieved.title || slot.retrieved.source}</strong>
                            </div>
                          ) : slot.scanFilled ? (
                            <div className="cx-slot-content">
                              <div>
                                <span className="cx-slot-shimmer" />
                                <i style={{ background: slot.dot, boxShadow: `0 0 0 4px ${slot.halo}` }} />
                              </div>
                              <strong className="cx-slot-shimmer" style={{ width: "80%" }} />
                            </div>
                          ) : (
                            <div className="cx-slot-skeleton">
                              <span />
                              <span />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {isResults && (
            <section className="cx-report-section" data-screen-label="Report" id="report">
              <div className="cx-report-bg" aria-hidden="true">
                <div className="cx-report-orb one" />
                <div className="cx-report-orb two" />
                <div className="cx-report-grid-mask" />
              </div>
              <div className="cx-report-shell">
                <div className="cx-report-header">
                  <div>
                    <div>{t("STEP 3 · REPORT", "الخطوة 3 · التقرير")}</div>
                    <h2>
                      {t("Scan complete", "اكتمل الفحص")}: {productName}
                    </h2>
                  </div>
                  <button className="cx-new-scan" onClick={resetToInput} type="button">
                    <RefreshMini />
                    {t("New scan", "فحص جديد")}
                  </button>
                </div>

                <div className="cx-score-panel">
                  <div className="cx-dial-wrap">
                    <svg width="140" height="140" viewBox="0 0 220 220" aria-hidden="true">
                      <circle cx="110" cy="110" r="100" fill="none" stroke="#e0eaea" strokeWidth="14" />
                      <circle
                        cx="110"
                        cy="110"
                        r="100"
                        fill="none"
                        stroke={dialColor}
                        strokeDasharray={CIRCUMFERENCE}
                        strokeLinecap="round"
                        strokeWidth="14"
                        style={{ strokeDashoffset: dialOffset, transition: "stroke-dashoffset 1.2s cubic-bezier(.16,.84,.44,1)" }}
                        transform="rotate(-90 110 110)"
                      />
                    </svg>
                    <div>
                      <strong style={{ color: dialColor }}>{dialDisplay}</strong>
                      <span>{t("Score", "الدرجة")}</span>
                    </div>
                  </div>

                  <div className="cx-score-copy">
                    <div className="cx-risk-line">
                      <span style={{ background: riskColor }} />
                      <strong style={{ color: riskColor }}>
                        {t("Risk", "المخاطر")}: {riskValueLabel}
                      </strong>
                    </div>
                    <div className="cx-report-meta">
                      <div>
                        <span>{t("Session reference", "المرجع الجلسي")}</span>
                        <strong>{refNumber}</strong>
                      </div>
                      <div>
                        <span>
                          <ClockMini />
                          {t("Scan date", "تاريخ الفحص")}
                        </span>
                        <strong>{scanDate}</strong>
                      </div>
                    </div>
                    <p>
                      {t(
                        `Checked against ${health?.indexed_articles?.toLocaleString() ?? "..."} indexed regulatory articles · Corpus ${health?.corpus_version ?? ""}`,
                        `تم الفحص مقابل ${health?.indexed_articles?.toLocaleString("ar-SA") ?? "..."} مادة تنظيمية مفهرسة · إصدار القاعدة ${health?.corpus_version ?? ""}`
                      )}
                    </p>
                    {clarifiedCount > 0 && (
                      <div className="cx-clarified-chip">
                        <CheckSmall />
                        {t(`Includes ${clarifiedCount} clarified detail${clarifiedCount > 1 ? "s" : ""} from the interview`, `يتضمن ${clarifiedCount} ${clarifiedCount > 1 ? "تفاصيل موضحة" : "تفصيلاً موضحاً"} من المقابلة`)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="cx-complexity-row">
                  <div>
                    <strong>{t("Detail level", "مستوى الشرح")}</strong>
                    <span>{currentComplexityCaption}</span>
                  </div>
                  <div>
                    {complexityDefs.map((item) => (
                      <button className={complexity === item.id ? "is-active" : ""} disabled={isRefetching} key={item.id} onClick={() => handleComplexityChange(item.id)} type="button">
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isRefetching && (
                  <div className="cx-refetch-bar">
                    <span className="cx-spinner" />
                    {t("Updating report...", "جارٍ تحديث التقرير...")}
                  </div>
                )}

                <div className="cx-summary-line">
                  <div>{t("Executive Summary", "الملخص التنفيذي")}</div>
                  <p dir={dirAttr}>{complianceResult?.executive_summary}</p>
                </div>

                <div className="cx-findings-block">
                  <div className="cx-findings-head">
                    <span>{t("Findings", "النتائج التفصيلية")}</span>
                    <strong>{t(`${gapCount} gaps · ${reviewCount} to review`, `${gapCount} فجوة · ${reviewCount} بحاجة لمراجعة`)}</strong>
                  </div>
                  <div className="cx-findings-list">
                    {(complianceResult?.findings ?? []).map((finding, idx) => {
                      const findingKey = `${finding.requirement.id}-${idx}`;
                      const expanded = expandedFindingId === findingKey;
                      const compliant = finding.status === "compliant";
                      const barColor = finding.status === "gap" ? "#b42318" : finding.status === "needs_review" ? "#a15c09" : "#147a5b";
                      const badgeBg = finding.status === "gap" ? "rgba(180,35,24,.1)" : finding.status === "needs_review" ? "rgba(161,92,9,.1)" : "rgba(20,122,91,.1)";
                      const statusLabel = finding.status === "gap" ? t("Gap", "فجوة") : finding.status === "needs_review" ? t("Needs Review", "بحاجة لمراجعة") : t("Compliant", "متوافق");
                      const findingNum = `F-${String(idx + 1).padStart(2, "0")}`;
                      return (
                        <article className={`cx-finding-row${compliant ? " is-compliant" : ""}`} key={findingKey}>
                          <button className="cx-finding-header" onClick={() => setExpandedFindingId(expanded ? null : findingKey)} style={{ borderInlineStartColor: barColor }} type="button">
                            <span className="cx-finding-num">{findingNum}</span>
                            <span style={{ background: badgeBg, color: barColor }}>{statusLabel}</span>
                            <em>{finding.requirement.article}</em>
                            {finding.requirement.regulator && <span className="cx-reg-tag">{finding.requirement.regulator}</span>}
                            <strong dir="auto">{finding.requirement.title}</strong>
                            <ChevronMini expanded={expanded} />
                          </button>
                          <div className={`cx-finding-body${expanded ? " is-expanded" : ""}`}>
                            <div dir={dirAttr} style={{ borderInlineStartColor: barColor }}>
                              <div className="cx-reg-basis">
                                <div className="cx-reg-basis-header">
                                  <BookMini />
                                  {t("Regulatory Basis", "الأساس التنظيمي")}
                                </div>
                                <div className="cx-reg-source-pill">
                                  <span>{finding.requirement.source}</span>
                                  <span className="cx-reg-dot" />
                                  <span>{finding.requirement.article}</span>
                                </div>
                                {finding.requirement.text && (
                                  <div className="cx-reg-verbatim" dir="auto">
                                    {finding.requirement.text}
                                  </div>
                                )}
                              </div>
                              {finding.user_answer_ref && (
                                <div className="cx-user-answer-note" dir="auto">
                                  <CheckSmall />
                                  <span>
                                    {t("Based on your interview answer:", "بناءً على إجابتك في المقابلة:")}{" "}
                                    <strong>{finding.user_answer_ref}</strong>
                                  </span>
                                </div>
                              )}
                              <div>{t("Analysis", "التحليل")}</div>
                              <p>{finding.analysis}</p>
                              <div>{t("Recommendation", "التوصية")}</div>
                              <p>{finding.recommendation}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                {complianceResult && (
                  <p className="cx-disclaimer" dir={dirAttr}>{isAr ? DISCLAIMER_AR : DISCLAIMER_EN}</p>
                )}

                <div className="cx-report-actions">
                  <button
                    className="cx-download-btn is-primary"
                    disabled={pdfBusy}
                    onClick={async () => {
                      if (!complianceResult) return;
                      setPdfBusy(true);
                      try {
                        await downloadPdfReport(complianceResult, lang, productName);
                      } catch {
                        downloadReport(); // graceful fallback to the plain-text export
                      } finally {
                        setPdfBusy(false);
                      }
                    }}
                    type="button"
                  >
                    <DownloadMini />
                    {pdfBusy ? t("Preparing PDF…", "جارٍ تجهيز PDF…") : t("Download PDF Report", "تحميل تقرير PDF")}
                  </button>
                  <button className="cx-download-btn" onClick={downloadReport} type="button">
                    <DownloadMini />
                    {t("Text version", "نسخة نصية")}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <button className="cx-chat-fab" onClick={() => setChatOpen((open) => !open)} type="button" aria-label={t("ComplyX Assistant", "مساعد ComplyX")}>
        <div />
        <ChatMini />
        <span />
      </button>

      <section className={`cx-chat-drawer${chatOpen ? " is-open" : ""}`} dir={dirAttr}>
        <div className="cx-chat-header">
          <div>
            <span>
              <ShieldChatMini />
            </span>
            <div>
              <strong>{t("ComplyX Assistant", "مساعد ComplyX")}</strong>
              <em>{t("Online · ask anything", "متصل · اسأل ما تشاء")}</em>
            </div>
          </div>
          <button onClick={() => setChatOpen(false)} type="button" aria-label={t("Close chat", "إغلاق المحادثة")}>
            <CloseMini />
          </button>
        </div>
        <div className="cx-chat-messages">
          <div className="cx-msg-row">
            <div>
              <span>
                <ShieldChatMini />
              </span>
              <p dir={dirAttr}>
                {t(
                  "Hello, I am the ComplyX assistant. Ask me about any regulatory article or scan finding and I will explain it.",
                  "مرحبًا، أنا مساعد ComplyX. اسألني عن أي مادة نظامية أو نتيجة فحص وسأشرحها لك."
                )}
              </p>
            </div>
          </div>
          {chatMessages.map((message) => (
            <div className={`cx-msg-row${message.fromUser ? " is-user" : ""}`} key={message.id}>
              <div>
                {!message.fromUser && (
                  <span>
                    <ShieldChatMini />
                  </span>
                )}
                <p dir="auto">{message.text}</p>
              </div>
            </div>
          ))}
          {chatTyping && (
            <div className="cx-msg-row">
              <div>
                <span className="cx-chat-avatar-blank" />
                <div className="cx-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="cx-chat-input-row">
          <input dir={dirAttr} onChange={(event) => setChatInputValue(event.target.value)} onKeyDown={onChatKey} placeholder={t("Ask about a finding or article...", "اسأل عن نتيجة أو مادة نظامية...")} value={chatInputValue} />
          <button onClick={sendChat} type="button" aria-label={t("Send", "إرسال")}>
            <SendMini flip={isAr} />
          </button>
        </div>
      </section>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="30" height="33" viewBox="0 0 200 220" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="navRim" x1="30" y1="26" x2="170" y2="198" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3ead4" />
          <stop offset="0.5" stopColor="#c9ad64" />
          <stop offset="1" stopColor="#8f7638" />
        </linearGradient>
        <linearGradient id="navInner" x1="44" y1="42" x2="156" y2="182" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#16d7c5" />
          <stop offset="0.55" stopColor="#12a8a0" />
          <stop offset="1" stopColor="#006b68" />
        </linearGradient>
      </defs>
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" fill="#062d35" stroke="url(#navRim)" strokeWidth="10" strokeLinejoin="round" />
      <path d="M64 42 L136 42 Q156 42 156 62 L156 106 Q156 148 100 182 Q44 148 44 106 L44 62 Q44 42 64 42 Z" fill="url(#navInner)" />
      <path d="M70 109 L90 129 L136 77" stroke="#04343d" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      <path d="M70 106 L90 126 L136 74" stroke="#ffffff" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldHero() {
  return (
    <svg width="310" height="342" viewBox="0 0 200 220" fill="none" className="cx-shield-hero">
      <defs>
        <linearGradient id="rimGrad" x1="20" y1="10" x2="180" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3ead4" />
          <stop offset="0.5" stopColor="#c9ad64" />
          <stop offset="1" stopColor="#8f7638" />
        </linearGradient>
        <linearGradient id="innerGrad" x1="40" y1="30" x2="160" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#16d7c5" />
          <stop offset="0.55" stopColor="#12a8a0" />
          <stop offset="1" stopColor="#006b68" />
        </linearGradient>
        <radialGradient id="glowGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#12a8a0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#12a8a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="shieldClip">
          <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="110" rx="114" ry="114" fill="url(#glowGrad)" className="cx-shield-glow" />
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" fill="#062d35" stroke="url(#rimGrad)" strokeWidth="8" strokeLinejoin="round" />
      <path d="M64 42 L136 42 Q156 42 156 62 L156 106 Q156 148 100 182 Q44 148 44 106 L44 62 Q44 42 64 42 Z" fill="url(#innerGrad)" />
      <path d="M64 42 L136 42 Q156 42 156 62 L156 106 Q156 148 100 182 Q44 148 44 106 L44 62 Q44 42 64 42 Z" fill="none" stroke="#dffcf7" strokeWidth="1.2" opacity="0.4" />
      <path d="M70 109 L90 131 L138 75" stroke="#04343d" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.38" />
      <path d="M70 106 L90 128 L138 72" stroke="#ffffff" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 105 L90 127 L138 71" stroke="#ffffff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <g clipPath="url(#shieldClip)">
        <rect x="-30" y="-40" width="46" height="300" fill="url(#shineGrad)" className="cx-shield-shine" />
      </g>
    </svg>
  );
}

function ShieldWatermark() {
  return (
    <svg width="380" height="418" viewBox="0 0 200 220" className="cx-shield-watermark" fill="none" stroke="#006b68" strokeWidth="4" strokeLinejoin="round" aria-hidden="true">
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" />
      <path d="M70 106 L90 126 L136 74" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function TraitIcon({ icon }: { icon: string }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#8fe8df" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {icon === "match" && <path d="M3 12h4l2 6 4-14 2 8h6" />}
      {icon === "cite" && (
        <>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M9 9h7M9 13h7M9 17h4" />
        </>
      )}
      {icon === "score" && (
        <>
          <path d="M4 15a8 8 0 0 1 16 0" />
          <path d="M12 15l4-4" />
          <circle cx="12" cy="15" r="1.4" />
        </>
      )}
      {icon === "lang" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </>
      )}
      {icon === "coverage" && (
        <>
          <path d="M12 3l9 5-9 5-9-5z" />
          <path d="M3 12.5l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </>
      )}
    </svg>
  );
}

function ProductIcon({ icon }: { icon: Product["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icon === "wallet" && (
        <>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M15 12.5h4v3h-4z" />
        </>
      )}
      {icon === "bnpl" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </>
      )}
      {icon === "gateway" && (
        <>
          <line x1="6" y1="4" x2="6" y2="20" />
          <line x1="18" y1="4" x2="18" y2="20" />
          <path d="M9 12h6M13 9l3 3-3 3" />
        </>
      )}
      {icon === "robo" && (
        <>
          <rect x="5" y="8" width="14" height="10" rx="3" />
          <circle cx="9.5" cy="13" r="1.2" />
          <circle cx="14.5" cy="13" r="1.2" />
          <line x1="12" y1="8" x2="12" y2="4" />
          <circle cx="12" cy="3.2" r="1" />
        </>
      )}
      {icon === "api" && (
        <>
          <circle cx="6" cy="7" r="2.4" />
          <circle cx="18" cy="7" r="2.4" />
          <circle cx="12" cy="18" r="2.4" />
          <line x1="8" y1="8.6" x2="10" y2="15.5" />
          <line x1="16" y1="8.6" x2="14" y2="15.5" />
          <line x1="8.6" y1="7" x2="15.4" y2="7" />
        </>
      )}
      {icon === "crypto" && (
        <>
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
          <path d="M9.5 12l2.5 2.5 2.5-2.5-2.5-2.5z" />
        </>
      )}
    </svg>
  );
}

function StepIcon({ icon }: { icon: StepDef["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7fa9a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icon === "doc" && (
        <>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </>
      )}
      {icon === "scale" && <path d="M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z" />}
      {icon === "shield" && (
        <>
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
          <path d="M9.3 12.2l1.9 1.9L15 9.8" />
        </>
      )}
      {icon === "gauge" && (
        <>
          <path d="M4 15a8 8 0 0 1 16 0" />
          <path d="M12 15l4-4" />
        </>
      )}
      {icon === "list" && <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />}
    </svg>
  );
}

function ModeIcon({ mode }: { mode: Mode }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {mode === "describe" && <path d="M4 6h16M4 12h16M4 18h9" />}
      {mode === "voice" && (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
        </>
      )}
    </svg>
  );
}

function CheckLarge() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function CheckMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#147a5b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CloseMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function UploadMini() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#006b68" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function MicMini() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function AudioMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#006b68" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" />
    </svg>
  );
}

function SearchMini() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}

function RefreshMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0e7d78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
    </svg>
  );
}

function ClockMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8a6d1f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BookMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChevronMini({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#65777d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${expanded ? 180 : 0}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function DownloadMini() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#006b68" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function ChatMini() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

function ShieldChatMini() {
  return (
    <svg width="14" height="15" viewBox="0 0 200 220" fill="none" stroke="#ffffff" strokeWidth="14" strokeLinejoin="round">
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" />
      <path d="M70 106 L90 126 L136 74" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SendMini({ flip }: { flip: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: flip ? "scaleX(-1)" : "none" }}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}
