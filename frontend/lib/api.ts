import { ComplianceResult, ProductType } from "./types";

export async function checkCompliance(product_description: string, product_type: ProductType) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_description, product_type })
  });
  if (!response.ok) throw new Error("تعذر تنفيذ فحص الامتثال");
  return (await response.json()) as ComplianceResult;
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

export async function downloadReport(result: ComplianceResult) {
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
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>ComplyX Report</title>
      <style>
        body{font-family:Arial,Tahoma,sans-serif;margin:32px;color:#172033}
        h1{color:#032341} table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #d9e0ea;padding:10px;vertical-align:top}
        th{background:#032341;color:white}
      </style>
    </head>
    <body>
      <h1>تقرير فحص الامتثال - ComplyX</h1>
      <p>${result.executive_summary}</p>
      <p>نسبة الامتثال: ${result.compliance_score}% | مستوى الخطورة: ${result.risk_level} | الثغرات: ${result.gaps_count}</p>
      <table>
        <thead><tr><th>المرجع</th><th>الحالة</th><th>المخاطر</th><th>التحليل</th><th>التوصية</th></tr></thead>
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
