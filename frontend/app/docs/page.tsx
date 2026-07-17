"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, FileText, Lightbulb, MessagesSquare, ShieldCheck, Sparkles, XCircle } from "lucide-react";

type Lang = "ar" | "en";

const essentials = [
  { en: "The product type and the core service it provides", ar: "نوع المنتج والخدمة الأساسية التي يقدمها" },
  { en: "Target users and whether they're inside or outside Saudi Arabia", ar: "الجمهور المستهدف وموقعهم داخل السعودية أو خارجها" },
  { en: "Licensing status or current stage in the application process", ar: "حالة الترخيص أو المرحلة الحالية للتقديم" },
  { en: "Integrations with banks, Mada, SADAD, SARIE, Nafath, or third parties", ar: "التكاملات مع البنوك، مدى، سداد، سريع، نفاذ، أو أطراف ثالثة" },
  { en: "The data you collect, store, or process", ar: "البيانات التي تجمعها أو تخزنها أو تعالجها" },
  { en: "Daily and monthly transaction limits, and per-transaction values", ar: "حدود العمليات اليومية والشهرية، وقيم العمليات المفردة" },
  { en: "Authentication method, fraud controls, and transaction monitoring", ar: "آلية المصادقة، مكافحة الاحتيال، ومراقبة العمليات" },
  { en: "Any credit, financing, installment, interest, or investment component", ar: "وجود ائتمان، تمويل، تقسيط، فوائد، أو عنصر استثماري" }
];

const weakPrompts = [
  { en: "Is my app compliant?", ar: "هل تطبيقي متوافق؟" },
  { en: "I have a digital wallet, check it.", ar: "عندي محفظة رقمية، افحصها." },
  { en: "Do we need a license?", ar: "هل نحتاج ترخيص؟" }
];

const strongPrompts = [
  {
    en: "We are building a digital wallet for residents and micro merchants in Saudi Arabia. The wallet lets users store tokenized cards, transfer money between local bank accounts, pay merchants through NFC and QR, receive refunds, and view a full transaction history. The product is before submitting a SAMA payment services licence application. Expected limits are SAR 2,500 per transaction, SAR 10,000 daily, and SAR 50,000 monthly. Integrations include Mada, SARIE, SADAD, Nafath, and a third party fraud monitoring provider. We collect national ID or iqama number, mobile number, device fingerprint, encrypted card tokens, transaction history, beneficiary data, and dispute records. I want to assess licensing requirements, safeguarding of customer funds, AML and fraud controls, data protection obligations, operational risk, and launch blockers.",
    ar: "نبني محفظة رقمية للمقيمين وأصحاب المشاريع الصغيرة داخل السعودية. تتيح تخزين البطاقات بشكل مرمز، تحويل الأموال بين الحسابات البنكية المحلية، الدفع للتجار عبر NFC وQR، استقبال الاستردادات، وعرض سجل كامل للعمليات. المنتج قبل تقديم طلب ترخيص مزود خدمات الدفع من ساما. الحدود المتوقعة: 2,500 ريال للعملية الواحدة، 10,000 ريال يومياً، و50,000 ريال شهرياً. التكاملات تشمل مدى، سريع، سداد، نفاذ، ومزود خارجي لمراقبة الاحتيال. نجمع رقم الهوية أو الإقامة، رقم الجوال، بصمة الجهاز، رموز البطاقات المشفرة، سجل العمليات، بيانات المستفيدين، وسجلات النزاعات. أريد تقييم الترخيص، حماية أموال العملاء، AML، الاحتيال، حماية البيانات، المخاطر التشغيلية، وعوائق الإطلاق."
  },
  {
    en: "We are launching a buy now pay later checkout product for Saudi e-commerce merchants. Customers are individuals inside Saudi Arabia and are verified through Nafath and a local credit bureau. The service splits the purchase value into 4 interest free installments over 8 weeks, with a maximum order value of SAR 3,000 and monthly customer exposure capped at SAR 8,000. Merchants receive settlement within 2 business days after deducting a merchant service fee. There are no late interest charges, but fixed administrative fees may apply after repeated missed payments. We collect identity data, income range, bureau score, repayment history, device data, merchant transaction data, and customer support records. I want to assess consumer finance treatment, disclosure requirements, affordability, Shariah considerations, collections, data protection, and compliance gaps before pilot launch.",
    ar: "نطلق منتج دفع آجل للمتاجر الإلكترونية السعودية. العملاء أفراد داخل السعودية ويتم التحقق منهم عبر نفاذ وأحد مكاتب المعلومات الائتمانية. الخدمة تقسم قيمة الشراء إلى 4 دفعات بدون فوائد خلال 8 أسابيع، بحد أعلى 3,000 ريال للطلب و8,000 ريال كتعرض شهري للعميل. يحصل التاجر على التسوية خلال يومي عمل بعد خصم عمولة خدمة التاجر. لا توجد فوائد تأخير، لكن قد توجد رسوم إدارية ثابتة عند تكرار التعثر. نجمع بيانات الهوية، نطاق الدخل، نتيجة المكتب الائتماني، سجل السداد، بيانات الجهاز، بيانات عمليات التاجر، وسجلات خدمة العملاء. أريد تقييم التمويل الاستهلاكي، الإفصاح، الملاءة، الاعتبارات الشرعية، التحصيل، حماية البيانات، وفجوات الامتثال قبل الإطلاق التجريبي."
  },
  {
    en: "We are building an automated investment advisory platform for retail investors in Saudi Arabia. The product asks about income, investment horizon, risk tolerance, financial goals, investment knowledge, and Shariah preference, then suggests a portfolio of Saudi and GCC ETFs and money market funds. The platform does not hold client assets directly, but sends execution orders to a licensed broker after user approval. We are before applying for a CMA fintech or investment advisory license. We collect KYC data, suitability answers, investment goals, execution orders, portfolio history, and consent records. I want to assess licensing impact, suitability and disclosure, conflicts of interest, audit impact, data protection, outsourcing, and Shariah screening.",
    ar: "نبني منصة استشارات استثمارية آلية للمستثمرين الأفراد في السعودية. يسأل المنتج عن الدخل، أفق الاستثمار، تحمل المخاطر، الأهداف المالية، المعرفة الاستثمارية، والتفضيل الشرعي، ثم يقترح محفظة من صناديق ETF سعودية وخليجية وصناديق سوق نقد. المنصة لا تحتفظ بأصول العملاء مباشرة، لكنها ترسل أوامر التنفيذ إلى وسيط مرخص بعد موافقة المستخدم. نحن قبل التقديم على مسار فنتك أو ترخيص استشارات استثمارية من هيئة السوق المالية. نجمع بيانات اعرف عميلك، إجابات الملاءمة، أهداف الاستثمار، أوامر التنفيذ، سجل المحفظة، وسجلات الموافقة. أريد تقييم أثر الترخيص، الملاءمة والإفصاح، تضارب المصالح، أثر التدقيق، حماية البيانات، الإسناد الخارجي، والفحص الشرعي."
  }
];

const templateLines = [
  { en: "We are building [product type] for [target audience] in [market/country].", ar: "نحن نبني [نوع المنتج] لـ [الجمهور المستهدف] في [السوق/الدولة]." },
  { en: "The service lets the user [core functions].", ar: "الخدمة تتيح للمستخدم [الوظائف الأساسية]." },
  { en: "Current licensing status: [licensed / applying / pre-application / unknown].", ar: "حالة الترخيص الحالية: [مرخص / قيد التقديم / قبل التقديم / غير معروف]." },
  { en: "Integrations: [banks, Mada, SADAD, SARIE, Nafath, third-party providers].", ar: "التكاملات: [بنوك، مدى، سداد، سريع، نفاذ، مزودين خارجيين]." },
  { en: "Data: [identity, financial data, transactions, biometric data, contact data].", ar: "البيانات: [هوية، بيانات مالية، معاملات، بيانات حيوية، بيانات اتصال]." },
  { en: "Limits: [per-transaction cap, daily limit, monthly limit, expected volumes].", ar: "الحدود: [حد العملية، الحد اليومي، الحد الشهري، أحجام متوقعة]." },
  { en: "Security and authentication: [OTP, MFA, biometrics, encryption, fraud monitoring].", ar: "الأمان والمصادقة: [OTP، MFA، بصمة، تشفير، مراقبة احتيال]." },
  { en: "Any sensitive element: [credit, financing, investment, cross-border transfer, data outside Saudi Arabia].", ar: "أي عنصر حساس: [ائتمان، تمويل، استثمار، تحويل دولي، بيانات خارج السعودية]." },
  { en: "I want a report showing requirements, gaps, risk level, and practical recommendations.", ar: "أريد تقريراً يوضح المتطلبات، الثغرات، مستوى المخاطر، والتوصيات العملية." }
];

const thinkingSteps = [
  { en: "Start with the product type: wallet, BNPL, payment gateway, Open Banking, robo-advisory.", ar: "ابدأ بنوع المنتج: محفظة، BNPL، بوابة دفع، Open Banking، Robo-advisory." },
  { en: "Define who will use it, and what they can do inside the product.", ar: "حدد من سيستخدمه، وما الذي يستطيع فعله داخل المنتج." },
  { en: "State the regulation-sensitive details: licensing, credit, data, transfers, limits, and third parties.", ar: "اذكر التفاصيل التنظيمية الحساسة: ترخيص، ائتمان، بيانات، تحويلات، حدود، وأطراف ثالثة." },
  { en: "Ask for a clear output: requirements, gaps, risks, recommendations, or follow-up questions.", ar: "اطلب مخرجاً واضحاً: متطلبات، ثغرات، مخاطر، توصيات، أو أسئلة متابعة." }
];

export default function DocsPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <main className="cx-doc-page" dir={isAr ? "rtl" : "ltr"}>
      <header className="cx-doc-topbar" dir="ltr">
        <Link className="cx-doc-back" href="/">
          <ArrowLeft size={17} />
          {t("Back to app", "العودة للتطبيق")}
        </Link>
        <div className="cx-brand">
          <DocLogo />
          <div className="cx-brand-copy">
            <span className="cx-brand-name">ComplyX</span>
            <span className="cx-brand-sub">PROMPT GUIDE</span>
          </div>
        </div>
        <div className="cx-lang-toggle">
          <div className={`cx-lang-indicator${isAr ? " is-ar" : ""}`} />
          <button className={`cx-lang-btn${!isAr ? " is-active" : ""}`} onClick={() => setLang("en")} type="button">
            EN
          </button>
          <button className={`cx-lang-btn${isAr ? " is-active" : ""}`} onClick={() => setLang("ar")} type="button">
            AR
          </button>
        </div>
      </header>

      <section className="cx-doc-hero">
        <div className="cx-doc-hero-copy">
          <span className="cx-doc-kicker">{t("Effective usage guide", "دليل الاستخدام الفعّال")}</span>
          <h1>{t("Write a clear description to get more accurate compliance answers.", "اكتب وصفاً واضحاً لتحصل على إجابات امتثال أدق.")}</h1>
          <p>
            {t(
              "Report quality depends on the quality of detail you provide. The more clearly you describe the product, customers, data, limits, and integrations, the better ComplyX can match your product to the right regulatory requirements and identify gaps.",
              "جودة التقرير تعتمد على جودة التفاصيل التي تقدمها. كلما وصفت المنتج، العملاء، البيانات، الحدود، والتكاملات بوضوح، استطاع ComplyX ربط منتجك بالمتطلبات التنظيمية المناسبة وتحديد الثغرات بشكل أفضل."
            )}
          </p>
        </div>
        <div className="cx-doc-score" aria-label="Prompt quality checklist">
          <Sparkles size={24} />
          <strong>{t("Quick rule", "قاعدة سريعة")}</strong>
          <span>{t("Write as if you're explaining the product to a compliance officer before a licensing meeting.", "اكتب كأنك تشرح المنتج لمسؤول امتثال قبل اجتماع ترخيص.")}</span>
        </div>
      </section>

      <section className="cx-doc-section cx-doc-two-col">
        <article className="cx-doc-panel">
          <div className="cx-doc-section-title">
            <ClipboardList size={20} />
            <h2>{t("What should you include?", "ما الذي يجب تضمينه؟")}</h2>
          </div>
          <div className="cx-doc-check-grid">
            {essentials.map((item) => (
              <div className="cx-doc-check" key={item.en}>
                <CheckCircle2 size={17} />
                <span>{t(item.en, item.ar)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="cx-doc-panel">
          <div className="cx-doc-section-title">
            <MessagesSquare size={20} />
            <h2>{t("How to think about the prompt", "طريقة التفكير في السؤال")}</h2>
          </div>
          <ol className="cx-doc-steps">
            {thinkingSteps.map((step) => (
              <li key={step.en}>{t(step.en, step.ar)}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="cx-doc-section">
        <div className="cx-doc-section-title">
          <ShieldCheck size={20} />
          <h2>{t("Quick examples", "أمثلة سريعة")}</h2>
        </div>
        <div className="cx-doc-example-grid">
          <article className="cx-doc-example is-weak">
            <div className="cx-doc-example-head">
              <XCircle size={19} />
              <strong>{t("Weak", "ضعيف")}</strong>
            </div>
            {weakPrompts.map((prompt) => (
              <p key={prompt.en}>{t(prompt.en, prompt.ar)}</p>
            ))}
          </article>
          <article className="cx-doc-example is-strong">
            <div className="cx-doc-example-head">
              <CheckCircle2 size={19} />
              <strong>{t("Better", "أفضل")}</strong>
            </div>
            {strongPrompts.map((prompt) => (
              <p key={prompt.en}>{t(prompt.en, prompt.ar)}</p>
            ))}
          </article>
        </div>
      </section>

      <section className="cx-doc-section cx-doc-template-section">
        <div className="cx-doc-section-title">
          <FileText size={20} />
          <h2>{t("Ready-to-copy template", "قالب جاهز للنسخ")}</h2>
        </div>
        <div className="cx-doc-template" dir={isAr ? "rtl" : "ltr"}>
          {templateLines.map((line) => (
            <p key={line.en}>{t(line.en, line.ar)}</p>
          ))}
        </div>
      </section>

      <section className="cx-doc-section cx-doc-final">
        <Lightbulb size={22} />
        <div>
          <h2>{t("After the report appears", "بعد ظهور التقرير")}</h2>
          <p>
            {t(
              "Use the consultant inside the report to ask follow-up questions like: what are the first three gaps to fix? What documents are needed? How do I lower the risk level? This turns the report from a general read into an action plan.",
              "استخدم المستشار داخل التقرير لطرح أسئلة متابعة مثل: ما أول ثلاث فجوات يجب علاجها؟ ما المستندات المطلوبة؟ كيف أخفف مستوى المخاطر؟ هذا يحول التقرير من قراءة عامة إلى خطة عمل."
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

function DocLogo() {
  return (
    <svg width="30" height="33" viewBox="0 0 200 220" fill="none" aria-hidden="true">
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" fill="#062d35" stroke="#b79a57" strokeWidth="10" strokeLinejoin="round" />
      <path d="M64 42 L136 42 Q156 42 156 62 L156 106 Q156 148 100 182 Q44 148 44 106 L44 62 Q44 42 64 42 Z" fill="#12a8a0" />
      <path d="M70 106 L90 126 L136 74" stroke="#ffffff" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
