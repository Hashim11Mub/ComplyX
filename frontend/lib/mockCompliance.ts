import { ComplianceResult, ProductType, Requirement } from "./types";

type MockRequirement = Requirement & {
  productTypes: ProductType[];
  signals: string[];
};

const requirements: MockRequirement[] = [
  {
    id: "consumer-finance-disclosure",
    source: "تنظيم التمويل الاستهلاكي",
    article: "متطلبات الإفصاح قبل العقد",
    title: "الإفصاح عن التكلفة وجدول السداد",
    text: "يجب الإفصاح عن معدل النسبة السنوية، إجمالي مبلغ السداد، عدد الأقساط، الرسوم، والغرامات قبل توقيع العقد.",
    keywords: ["إفصاح", "رسوم", "أقساط", "نسبة سنوية"],
    productTypes: ["consumer_finance", "general"],
    signals: ["إفصاح", "النسبة", "رسوم", "أقساط", "جدول"]
  },
  {
    id: "consumer-finance-complaints",
    source: "تنظيم التمويل الاستهلاكي",
    article: "معالجة الشكاوى",
    title: "قناة رسمية لشكاوى العملاء",
    text: "يوفر مقدم الخدمة قناة رسمية وواضحة لاستقبال الشكاوى وتوثيق نتيجة المعالجة.",
    keywords: ["شكاوى", "عملاء", "توثيق"],
    productTypes: ["consumer_finance", "payment_services", "open_banking", "general"],
    signals: ["شكاوى", "دعم", "نزاعات", "استفسارات"]
  },
  {
    id: "payments-security",
    source: "ضوابط خدمات الدفع",
    article: "أمن المدفوعات",
    title: "المصادقة والتشفير ومراقبة الاحتيال",
    text: "تفعل المصادقة الثنائية للتحويلات، وتراقب المعاملات آليا، وتشفر بيانات الدفع.",
    keywords: ["مصادقة", "تشفير", "احتيال"],
    productTypes: ["payment_services", "open_banking", "general"],
    signals: ["مصادقة", "تشفير", "احتيال", "ثنائية"]
  },
  {
    id: "payments-limits",
    source: "ضوابط خدمات الدفع",
    article: "حدود المعاملات والمحافظ",
    title: "حدود الرصيد والتحويلات",
    text: "تحدد حدود الرصيد والتحويلات اليومية والشهرية حسب مستوى تحقق العميل.",
    keywords: ["حدود", "رصيد", "تحويلات"],
    productTypes: ["payment_services", "general"],
    signals: ["حدود", "رصيد", "تحويل"]
  },
  {
    id: "pdpl-consent",
    source: "نظام حماية البيانات الشخصية",
    article: "اشتراطات الموافقة الصريحة",
    title: "موافقة صريحة ومستقلة",
    text: "يشترط الحصول على موافقة واضحة ومستقلة قبل معالجة البيانات الشخصية، مع حق سحب الموافقة.",
    keywords: ["موافقة", "بيانات", "سحب"],
    productTypes: ["pdpl", "open_banking", "general"],
    signals: ["موافقة", "بيانات", "سحب", "خصوصية"]
  },
  {
    id: "aml-kyc",
    source: "متطلبات مكافحة غسل الأموال",
    article: "اعرف عميلك",
    title: "التحقق من هوية العميل",
    text: "يلتزم مزود الخدمة بالتحقق من هوية العميل قبل فتح الحساب وتطبيق عناية واجبة معززة عند ارتفاع المخاطر.",
    keywords: ["اعرف عميلك", "هوية", "تحقق"],
    productTypes: ["aml", "payment_services", "open_banking", "consumer_finance", "general"],
    signals: ["هوية", "تحقق", "اعرف", "عميلك", "عناية"]
  }
];

const negativeSignals = ["لا توجد", "لا يوجد", "بدون", "غير متوفر", "لم يتم"];

function hasNegativeSignalForRequirement(description: string, signals: string[]) {
  return signals.some((signal) =>
    negativeSignals.some((negativeSignal) => {
      const negativeIndex = description.indexOf(negativeSignal);
      const signalIndex = description.indexOf(signal);
      if (negativeIndex === -1 || signalIndex === -1) return false;
      return negativeIndex <= signalIndex && signalIndex - negativeIndex <= 50;
    })
  );
}

export function mockCheckCompliance(product_description: string, product_type: ProductType): ComplianceResult {
  const relevant = requirements.filter((item) => item.productTypes.includes(product_type)).slice(0, 6);
  const findings = relevant.map((requirement) => {
    const matches = requirement.signals.filter((signal) => product_description.includes(signal));
    const negative = hasNegativeSignalForRequirement(product_description, requirement.signals);
    const status = negative ? "gap" : matches.length > 0 ? "compliant" : "needs_review";
    const risk = status === "gap" ? "high" : status === "needs_review" ? "medium" : "low";

    return {
      requirement,
      status,
      risk,
      analysis:
        status === "compliant"
          ? `وصف المنتج يتضمن مؤشرات واضحة مرتبطة بـ ${matches.slice(0, 3).join("، ")}.`
          : status === "gap"
            ? "توجد صياغة تنفي أو تستبعد ضابطا مرتبطا بهذا الالتزام التنظيمي."
            : "الوصف لا يكفي لإثبات الالتزام الكامل، ويحتاج إلى دليل تشغيلي أو سياسة مكتوبة.",
      recommendation:
        status === "compliant"
          ? "اربط هذا الضابط بدليل قابل للمراجعة وسجل مالك الضابط."
          : "أضف الإجراء، المالك، الدليل المطلوب، وتاريخ المراجعة قبل الإطلاق."
    } as const;
  });

  const score = Math.round(
    findings.reduce((sum, item) => sum + (item.status === "compliant" ? 100 : item.status === "needs_review" ? 62 : 20), 0) /
      Math.max(findings.length, 1)
  );
  const gaps = findings.filter((item) => item.status === "gap").length;

  return {
    product_type,
    compliance_score: score,
    risk_level: score >= 82 ? "low" : score >= 58 ? "medium" : "high",
    gaps_count: gaps,
    findings,
    executive_summary:
      score >= 82
        ? "المنتج يظهر جاهزية امتثال جيدة، مع الحاجة إلى توثيق الأدلة التشغيلية."
        : score >= 58
          ? `المنتج قابل للتحسين قبل الإطلاق؛ توجد ${gaps} ثغرات ونقاط تحتاج مراجعة.`
          : `مستوى المخاطر مرتفع؛ يجب معالجة ${gaps} ثغرات جوهرية قبل الإطلاق.`,
    agent_steps: [
      "استرجاع الأنظمة",
      "استخلاص الاشتراطات",
      "مطابقة المنتج",
      "تحليل الثغرات",
      "تجهيز التقرير"
    ],
    disclaimer: "هذا نموذج أولي للعرض ولا يعتبر رأيا قانونيا نهائيا."
  };
}

export function mockConsultation(query: string) {
  const references = requirements
    .filter((item) => item.signals.some((signal) => query.includes(signal)) || query.includes(item.source.slice(0, 6)))
    .slice(0, 3);
  const selected = references.length ? references : requirements.slice(0, 3);

  return {
    answer: `بناء على النموذج الأولي، راجع ${selected
      .map((item) => `${item.source} - ${item.article}`)
      .join("، ")}. التوصية: حدد الالتزام، الدليل المطلوب، مالك الضابط، وتاريخ المراجعة قبل اعتماد المنتج.`,
    references: selected
  };
}
