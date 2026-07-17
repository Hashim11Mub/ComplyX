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
  "نبني محفظة رقمية للمقيمين وأصحاب المشاريع الصغيرة داخل السعودية. تتيح تخزين البطاقات بشكل مرمز، تحويل الأموال بين الحسابات البنكية المحلية، الدفع للتجار عبر NFC وQR، استقبال الاستردادات، وعرض سجل كامل للعمليات. المنتج قبل تقديم طلب ترخيص مزود خدمات الدفع من ساما. الحدود المتوقعة: 2,500 ريال للعملية الواحدة، 10,000 ريال يومياً، و50,000 ريال شهرياً. التكاملات تشمل مدى، سريع، سداد، نفاذ، ومزود خارجي لمراقبة الاحتيال. نجمع رقم الهوية أو الإقامة، رقم الجوال، بصمة الجهاز، رموز البطاقات المشفرة، سجل العمليات، بيانات المستفيدين، وسجلات النزاعات. أريد تقييم الترخيص، حماية أموال العملاء، AML، الاحتيال، حماية البيانات، المخاطر التشغيلية، وعوائق الإطلاق.",
  "نطلق منتج دفع آجل للمتاجر الإلكترونية السعودية. العملاء أفراد داخل السعودية ويتم التحقق منهم عبر نفاذ وأحد مكاتب المعلومات الائتمانية. الخدمة تقسم قيمة الشراء إلى 4 دفعات بدون فوائد خلال 8 أسابيع، بحد أعلى 3,000 ريال للطلب و8,000 ريال كتعرض شهري للعميل. يحصل التاجر على التسوية خلال يومي عمل بعد خصم عمولة خدمة التاجر. لا توجد فوائد تأخير، لكن قد توجد رسوم إدارية ثابتة عند تكرار التعثر. نجمع بيانات الهوية، نطاق الدخل، نتيجة المكتب الائتماني، سجل السداد، بيانات الجهاز، بيانات عمليات التاجر، وسجلات خدمة العملاء. أريد تقييم التمويل الاستهلاكي، الإفصاح، الملاءة، الاعتبارات الشرعية، التحصيل، حماية البيانات، وفجوات الامتثال قبل الإطلاق التجريبي.",
  "نبني منصة استشارات استثمارية آلية للمستثمرين الأفراد في السعودية. يسأل المنتج عن الدخل، أفق الاستثمار، تحمل المخاطر، الأهداف المالية، المعرفة الاستثمارية، والتفضيل الشرعي، ثم يقترح محفظة من صناديق ETF سعودية وخليجية وصناديق سوق نقد. المنصة لا تحتفظ بأصول العملاء مباشرة، لكنها ترسل أوامر التنفيذ إلى وسيط مرخص بعد موافقة المستخدم. نحن قبل التقديم على مسار فنتك أو ترخيص استشارات استثمارية من هيئة السوق المالية. نجمع بيانات اعرف عميلك، إجابات الملاءمة، أهداف الاستثمار، أوامر التنفيذ، سجل المحفظة، وسجلات الموافقة. أريد تقييم أثر الترخيص، الملاءمة والإفصاح، تضارب المصالح، أثر التدقيق، حماية البيانات، الإسناد الخارجي، والفحص الشرعي."
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
