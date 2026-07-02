import { ComplianceResult, ClarifyResponse, ProductType } from "./types";

export async function checkCompliance(
  product_description: string,
  product_type: ProductType,
  tone: "simple" | "executive" | "technical" = "executive",
  lang: "ar" | "en" = "ar"
) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_description, product_type, tone, lang })
  });
  if (!response.ok) throw new Error("تعذر تنفيذ فحص الامتثال");
  return (await response.json()) as ComplianceResult;
}

export async function getProductQuestions(
  product_description: string,
  product_type: ProductType,
  lang: "ar" | "en" = "ar"
): Promise<ClarifyResponse> {
  try {
    const response = await fetch("/api/clarify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_description, product_type, lang })
    });
    if (!response.ok) return { questions: [] };
    return (await response.json()) as ClarifyResponse;
  } catch {
    return { questions: [] };
  }
}

export async function askConsultant(query: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, messages })
  });
  if (!response.ok) throw new Error("تعذر إرسال الاستشارة");
  return response.json() as Promise<{ answer: string }>;
}

type DownloadOptions = {
  lang?: "ar" | "en";
  tone?: "executive" | "technical" | "simple";
};

const downloadCopy = {
  ar: {
    dir: "rtl",
    title: "تقرير فحص الامتثال - ComplyX",
    summary: "الملخص التنفيذي",
    stats: "نسبة الامتثال",
    risk: "مستوى الخطورة",
    gaps: "الثغرات",
    tone: "أسلوب التقرير",
    tones: {
      executive: "تنفيذي",
      technical: "تقني",
      simple: "مبسّط"
    },
    headers: ["المرجع", "الحالة", "المخاطر", "التحليل", "التوصية"]
  },
  en: {
    dir: "ltr",
    title: "ComplyX Compliance Scan Report",
    summary: "Executive summary",
    stats: "Compliance score",
    risk: "Risk level",
    gaps: "Gaps",
    tone: "Report tone",
    tones: {
      executive: "Executive",
      technical: "Technical",
      simple: "Simple"
    },
    headers: ["Reference", "Status", "Risk", "Analysis", "Recommendation"]
  }
};

export async function downloadReport(result: ComplianceResult, options: DownloadOptions = {}) {
  const lang = options.lang ?? "ar";
  const tone = options.tone ?? "executive";
  const t = downloadCopy[lang];
  const rows = result.findings
    .map(
      (finding) => `
        <tr>
          <td>${finding.requirement.source} - ${finding.requirement.article}</td>
          <td>${finding.status}</td>
          <td>${finding.risk}</td>
          <td>${finding.analysis}</td>
          <td>${finding.recommendation}</td>
        </tr>`
    )
    .join("");
  const html = `<!doctype html>
  <html lang="${lang}" dir="${t.dir}">
    <head>
      <meta charset="utf-8" />
      <title>ComplyX Report</title>
      <style>
        body{font-family:Arial,Tahoma,sans-serif;margin:32px;color:#172033;line-height:1.65}
        h1{color:#032341} table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #d9e0ea;padding:10px;vertical-align:top}
        th{background:#032341;color:white}
        .meta{background:#eef6f5;border:1px solid #d9e5e6;border-radius:8px;padding:14px 16px}
      </style>
    </head>
    <body>
      <h1>${t.title}</h1>
      <div class="meta">
        <strong>${t.summary}</strong>
        <p>${result.executive_summary}</p>
        <p>${t.tone}: ${t.tones[tone]}</p>
        <p>${t.stats}: ${result.compliance_score}% | ${t.risk}: ${result.risk_level} | ${t.gaps}: ${result.gaps_count}</p>
      </div>
      <table>
        <thead><tr>${t.headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>${result.disclaimer}</p>
    </body>
  </html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "complyx-report.html";
  link.click();
  URL.revokeObjectURL(url);
}
