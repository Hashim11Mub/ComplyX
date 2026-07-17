"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

type Lang = "ar" | "en";

type Tier = {
  id: "launch" | "growth" | "enterprise";
  accent: "teal" | "gold" | "coral";
  badge?: { en: string; ar: string };
  name: { en: string; ar: string };
  audience: { en: string; ar: string };
  price: { en: string; ar: string };
  priceNote: { en: string; ar: string };
  cta: { en: string; ar: string };
  features: { en: string; ar: string }[];
};

const TIERS: Tier[] = [
  {
    id: "launch",
    accent: "teal",
    name: { en: "Launch", ar: "انطلاقة" },
    audience: { en: "Pre-license fintechs and early-stage teams", ar: "شركات التقنية المالية قبل الترخيص والفرق الناشئة" },
    price: { en: "SAR 490", ar: "490 ريال" },
    priceNote: { en: "per month · free if you bank with Alinma", ar: "شهرياً · مجاناً إذا كنت عميل الإنماء" },
    cta: { en: "Start scanning", ar: "ابدأ الفحص" },
    features: [
      { en: "1 product or business model", ar: "منتج أو نموذج عمل واحد" },
      { en: "Unlimited self-service scans across SAMA, CMA, PDPL and Shariah", ar: "فحوصات ذاتية غير محدودة عبر ساما وهيئة السوق المالية وهيئة البيانات والمعايير الشرعية" },
      { en: "Bilingual scored report with PDF export", ar: "تقرير مُقيَّم ثنائي اللغة مع تصدير PDF" },
      { en: "Clarification interview and AI consultant chat", ar: "مقابلة توضيحية ومساعد محادثة ذكي" },
      { en: "Email support", ar: "دعم عبر البريد الإلكتروني" }
    ]
  },
  {
    id: "growth",
    accent: "gold",
    badge: { en: "Most requested", ar: "الأكثر طلباً" },
    name: { en: "Growth", ar: "نمو" },
    audience: { en: "Scaling teams tracking their path to a license", ar: "فرق في مرحلة النمو تتابع مسارها نحو الترخيص" },
    price: { en: "SAR 1,900", ar: "1,900 ريال" },
    priceNote: { en: "per month, billed monthly", ar: "شهرياً" },
    cta: { en: "Start scanning", ar: "ابدأ الفحص" },
    features: [
      { en: "Everything in Launch, plus:", ar: "كل ما في انطلاقة، بالإضافة إلى:" },
      { en: "Up to 5 products or business lines", ar: "حتى 5 منتجات أو خطوط أعمال" },
      { en: "License-readiness tracking over time", ar: "تتبع نسبة الجاهزية للترخيص عبر الوقت" },
      { en: "Priority AI consultant responses", ar: "أولوية في استجابة المستشار الذكي" },
      { en: "Full multi-regulator scope on every scan", ar: "نطاق كامل عبر جميع الجهات في كل فحص" },
      { en: "Exportable scan history for internal review", ar: "سجل فحوصات قابل للتصدير للمراجعة الداخلية" }
    ]
  },
  {
    id: "enterprise",
    accent: "coral",
    name: { en: "Enterprise", ar: "المؤسسات" },
    audience: { en: "Licensed institutions, banks, and internal product teams", ar: "المؤسسات المرخصة، البنوك، وفرق المنتجات الداخلية" },
    price: { en: "From SAR 6,900", ar: "من 6,900 ريال" },
    priceNote: { en: "per month · custom pricing above this scope", ar: "شهرياً · تسعير مخصص لما هو أبعد من هذا النطاق" },
    cta: { en: "Start scanning", ar: "ابدأ الفحص" },
    features: [
      { en: "Everything in Growth, plus:", ar: "كل ما في نمو، بالإضافة إلى:" },
      { en: "Unlimited products and business lines", ar: "منتجات وخطوط أعمال غير محدودة" },
      { en: "Compliance Desk dashboard access (early access)", ar: "وصول للوحة مكتب الامتثال (وصول مبكر)" },
      { en: "Dedicated onboarding and account manager", ar: "تأهيل مخصص ومدير حساب مخصص" },
      { en: "Custom corpus additions on request", ar: "إضافة وثائق تنظيمية مخصصة عند الطلب" },
      { en: "API access and audit-log export", ar: "وصول API وتصدير سجل التدقيق" }
    ]
  }
];

export default function PackagesPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <main className="cx-doc-page cx-pkg-page" dir={isAr ? "rtl" : "ltr"}>
      <header className="cx-doc-topbar" dir="ltr">
        <Link className="cx-doc-back" href="/">
          <ArrowLeft size={17} />
          {t("Back to app", "العودة للتطبيق")}
        </Link>
        <div className="cx-brand">
          <PkgLogo />
          <div className="cx-brand-copy">
            <span className="cx-brand-name">ComplyX</span>
            <span className="cx-brand-sub">PACKAGES</span>
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

      <section className="cx-pkg-hero">
        <span className="cx-doc-kicker">{t("Pricing", "الأسعار")}</span>
        <h1>{t("Packages built around where your company actually is.", "باقات مبنية على مرحلة شركتك الفعلية.")}</h1>
        <p>
          {t(
            "From a pre-license idea to a fully licensed institution, pick the tier that matches your stage. Every tier runs on the same engine: grounded citations, a deterministic score, and a report you can hand to a regulator.",
            "من فكرة قبل الترخيص إلى مؤسسة مرخصة بالكامل، اختر الباقة التي تناسب مرحلتك. كل باقة تعمل بنفس المحرك: استشهادات موثقة، نسبة تقييم حتمية، وتقرير يمكنك تسليمه لجهة تنظيمية."
          )}
        </p>
      </section>

      <section className="cx-pkg-grid">
        {TIERS.map((tier) => (
          <article className={`cx-pkg-card is-${tier.accent}`} key={tier.id}>
            {tier.badge && <span className="cx-pkg-badge">{t(tier.badge.en, tier.badge.ar)}</span>}
            <h2>{t(tier.name.en, tier.name.ar)}</h2>
            <p className="cx-pkg-audience">{t(tier.audience.en, tier.audience.ar)}</p>
            <div className="cx-pkg-price">
              <strong>{t(tier.price.en, tier.price.ar)}</strong>
              <span>{t(tier.priceNote.en, tier.priceNote.ar)}</span>
            </div>
            <ul className="cx-pkg-features">
              {tier.features.map((feature) => (
                <li key={feature.en}>
                  <Check size={16} />
                  <span>{t(feature.en, feature.ar)}</span>
                </li>
              ))}
            </ul>
            <Link className="cx-pkg-cta" href="/">
              {t(tier.cta.en, tier.cta.ar)}
            </Link>
          </article>
        ))}
      </section>

      <section className="cx-pkg-note">
        <p>
          {t(
            "How we priced this: a small-entity statutory audit in Saudi Arabia typically starts around SAR 15,000 a year, and a mid-size annual audit with quarterly review commonly runs SAR 150,000–250,000 a year. Global compliance-automation platforms list in the same range, roughly $10,000–80,000+ a year. Every ComplyX tier sits meaningfully below both, because a continuous AI-native scan costs a fraction of a periodic manual engagement, and we would rather pass that saving on than match the market.",
            "كيف حددنا الأسعار: التدقيق النظامي لمنشأة صغيرة في السعودية يبدأ عادةً من نحو 15,000 ريال سنوياً، والتدقيق السنوي لمنشأة متوسطة مع مراجعة ربع سنوية يتراوح غالباً بين 150,000 و250,000 ريال سنوياً. منصات أتمتة الامتثال العالمية تقع في النطاق ذاته تقريباً، من 10,000 إلى أكثر من 80,000 دولار سنوياً. كل باقة في ضامن أقل بشكل ملموس من الاثنين معاً، لأن الفحص المستمر المعتمد على الذكاء الاصطناعي يكلف جزءاً يسيراً من الالتزام الدوري اليدوي، ونحن نُفضّل تمرير هذا التوفير لكم بدل مجاراة السوق."
          )}
        </p>
        <p className="cx-pkg-note-small">
          {t(
            "Packaging reflects our pricing plan. The live build today is one unified product, open for evaluation end to end.",
            "الباقات تعكس خطة التسعير لدينا. النسخة الحالية منتج موحّد واحد، متاح بالكامل للتقييم."
          )}
        </p>
      </section>
    </main>
  );
}

function PkgLogo() {
  return (
    <svg width="30" height="33" viewBox="0 0 200 220" fill="none" aria-hidden="true">
      <path d="M52 26 L148 26 Q170 26 170 48 L170 108 Q170 158 100 198 Q30 158 30 108 L30 48 Q30 26 52 26 Z" fill="#062d35" stroke="#b79a57" strokeWidth="10" strokeLinejoin="round" />
      <path d="M64 42 L136 42 Q156 42 156 62 L156 106 Q156 148 100 182 Q44 148 44 106 L44 62 Q44 42 64 42 Z" fill="#12a8a0" />
      <path d="M70 106 L90 126 L136 74" stroke="#ffffff" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
