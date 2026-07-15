import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, FileText, Lightbulb, MessagesSquare, ShieldCheck, Sparkles, XCircle } from "lucide-react";

const essentials = [
  "نوع المنتج والخدمة الأساسية التي يقدمها",
  "الجمهور المستهدف وموقعهم داخل السعودية أو خارجها",
  "حالة الترخيص أو المرحلة الحالية للتقديم",
  "التكاملات مع البنوك، مدى، سداد، سريع، نفاذ، أو أطراف ثالثة",
  "البيانات التي تجمعها أو تخزنها أو تعالجها",
  "حدود العمليات اليومية والشهرية، وقيم العمليات المفردة",
  "آلية المصادقة، مكافحة الاحتيال، ومراقبة العمليات",
  "وجود ائتمان، تمويل، تقسيط، فوائد، أو عنصر استثماري"
];

const weakPrompts = [
  "هل تطبيقي متوافق؟",
  "عندي محفظة رقمية، افحصها.",
  "هل نحتاج ترخيص؟"
];

const strongPrompts = [
  "نطوّر محفظة رقمية للمقيمين في السعودية تتيح تخزين البطاقات، تحويل الأموال بين حسابات بنكية محلية، والدفع عبر NFC. المنتج في مرحلة ما قبل طلب ترخيص مزود خدمات الدفع من ساما. الحد اليومي المتوقع 5,000 ريال، والتكاملات تشمل مدى وسداد ونفاذ. نجمع بيانات الهوية الوطنية/الإقامة، رقم الجوال، بيانات البطاقة المشفرة، وسجل العمليات. المصادقة عبر OTP وبصمة الجهاز، مع مراقبة عمليات لحظية وتنبيهات احتيال.",
  "نطلق خدمة BNPL للمتاجر الإلكترونية السعودية تقسم المشتريات إلى 4 دفعات بدون فوائد. العملاء أفراد داخل السعودية، ويتم التحقق عبر نفاذ وفحص ائتماني. الحد الأعلى للطلب 3,000 ريال. لا توجد فوائد تأخير حالياً، لكن توجد رسوم إدارية ثابتة. نحتاج معرفة المتطلبات التنظيمية، الإفصاحات، إدارة المخاطر، وحماية بيانات العملاء."
];

const templateLines = [
  "نحن نبني [نوع المنتج] لـ [الجمهور المستهدف] في [السوق/الدولة].",
  "الخدمة تتيح للمستخدم [الوظائف الأساسية].",
  "حالة الترخيص الحالية: [مرخص / قيد التقديم / قبل التقديم / غير معروف].",
  "التكاملات: [بنوك، مدى، سداد، سريع، نفاذ، مزودين خارجيين].",
  "البيانات: [هوية، بيانات مالية، معاملات، بيانات حيوية، بيانات اتصال].",
  "الحدود: [حد العملية، الحد اليومي، الحد الشهري، أحجام متوقعة].",
  "الأمان والمصادقة: [OTP، MFA، بصمة، تشفير، مراقبة احتيال].",
  "أي عنصر حساس: [ائتمان، تمويل، استثمار، تحويل دولي، بيانات خارج السعودية].",
  "أريد تقريراً يوضح المتطلبات، الثغرات، مستوى المخاطر، والتوصيات العملية."
];

export default function DocsPage() {
  return (
    <main className="cx-doc-page" dir="rtl">
      <header className="cx-doc-topbar" dir="ltr">
        <Link className="cx-doc-back" href="/">
          <ArrowLeft size={17} />
          Back to app
        </Link>
        <div className="cx-brand">
          <DocLogo />
          <div className="cx-brand-copy">
            <span className="cx-brand-name">ComplyX</span>
            <span className="cx-brand-sub">PROMPT GUIDE</span>
          </div>
        </div>
      </header>

      <section className="cx-doc-hero">
        <div className="cx-doc-hero-copy">
          <span className="cx-doc-kicker">دليل الاستخدام الفعّال</span>
          <h1>اكتب وصفاً واضحاً لتحصل على إجابات امتثال أدق.</h1>
          <p>
            جودة التقرير تعتمد على جودة التفاصيل التي تقدمها. كلما وصفت المنتج، العملاء، البيانات، الحدود، والتكاملات بوضوح،
            استطاع ComplyX ربط منتجك بالمتطلبات التنظيمية المناسبة وتحديد الثغرات بشكل أفضل.
          </p>
        </div>
        <div className="cx-doc-score" aria-label="Prompt quality checklist">
          <Sparkles size={24} />
          <strong>قاعدة سريعة</strong>
          <span>اكتب كأنك تشرح المنتج لمسؤول امتثال قبل اجتماع ترخيص.</span>
        </div>
      </section>

      <section className="cx-doc-section cx-doc-two-col">
        <article className="cx-doc-panel">
          <div className="cx-doc-section-title">
            <ClipboardList size={20} />
            <h2>ما الذي يجب تضمينه؟</h2>
          </div>
          <div className="cx-doc-check-grid">
            {essentials.map((item) => (
              <div className="cx-doc-check" key={item}>
                <CheckCircle2 size={17} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="cx-doc-panel">
          <div className="cx-doc-section-title">
            <MessagesSquare size={20} />
            <h2>طريقة التفكير في السؤال</h2>
          </div>
          <ol className="cx-doc-steps">
            <li>ابدأ بنوع المنتج: محفظة، BNPL، بوابة دفع، Open Banking، Robo-advisory.</li>
            <li>حدد من سيستخدمه، وما الذي يستطيع فعله داخل المنتج.</li>
            <li>اذكر التفاصيل التنظيمية الحساسة: ترخيص، ائتمان، بيانات، تحويلات، حدود، وأطراف ثالثة.</li>
            <li>اطلب مخرجاً واضحاً: متطلبات، ثغرات، مخاطر، توصيات، أو أسئلة متابعة.</li>
          </ol>
        </article>
      </section>

      <section className="cx-doc-section">
        <div className="cx-doc-section-title">
          <ShieldCheck size={20} />
          <h2>أمثلة سريعة</h2>
        </div>
        <div className="cx-doc-example-grid">
          <article className="cx-doc-example is-weak">
            <div className="cx-doc-example-head">
              <XCircle size={19} />
              <strong>ضعيف</strong>
            </div>
            {weakPrompts.map((prompt) => (
              <p key={prompt}>{prompt}</p>
            ))}
          </article>
          <article className="cx-doc-example is-strong">
            <div className="cx-doc-example-head">
              <CheckCircle2 size={19} />
              <strong>أفضل</strong>
            </div>
            {strongPrompts.map((prompt) => (
              <p key={prompt}>{prompt}</p>
            ))}
          </article>
        </div>
      </section>

      <section className="cx-doc-section cx-doc-template-section">
        <div className="cx-doc-section-title">
          <FileText size={20} />
          <h2>قالب جاهز للنسخ</h2>
        </div>
        <div className="cx-doc-template" dir="rtl">
          {templateLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="cx-doc-section cx-doc-final">
        <Lightbulb size={22} />
        <div>
          <h2>بعد ظهور التقرير</h2>
          <p>
            استخدم المستشار داخل التقرير لطرح أسئلة متابعة مثل: ما أول ثلاث فجوات يجب علاجها؟ ما المستندات المطلوبة؟ كيف أخفف
            مستوى المخاطر؟ هذا يحول التقرير من قراءة عامة إلى خطة عمل.
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
