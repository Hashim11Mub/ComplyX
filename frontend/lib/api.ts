import { ChatSessionContext, ComplianceResult, ClarifyResponse, Corpus, Finding, HealthInfo, ProductType, RetrievedArticle } from "./types";

export async function checkCompliance(
  product_description: string,
  product_type: ProductType,
  tone: "simple" | "executive" | "technical" = "executive",
  lang: "ar" | "en" = "ar",
  corpora?: Corpus[]
) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_description, product_type, tone, lang, corpora })
  });
  if (!response.ok) throw new Error("تعذر تنفيذ فحص الامتثال");
  return (await response.json()) as ComplianceResult;
}

/**
 * Re-render an existing report in a new tone/language without re-classifying
 * anything. Sends the existing findings (with their status/risk) back; the
 * backend never lets the LLM revise those two fields, so the compliance
 * score is guaranteed to stay identical to the original scan.
 */
export async function retoneReport(
  findings: Finding[],
  product_type: ProductType,
  tone: "simple" | "executive" | "technical",
  lang: "ar" | "en",
  executive_summary = ""
) {
  const response = await fetch("/api/retone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_type, tone, lang, findings, executive_summary })
  });
  if (!response.ok) throw new Error("تعذر إعادة صياغة التقرير");
  return (await response.json()) as ComplianceResult;
}

type StreamHandlers = {
  onRetrieved?: (articles: RetrievedArticle[]) => void;
  /** Arabic sessions: translated titles for the retrieved articles, same order. */
  onRetrievedAr?: (titles: string[]) => void;
  onFinding?: (finding: Finding) => void;
};

/**
 * Streaming scan (SSE over fetch). Resolves with the full ComplianceResult;
 * rejects on any transport or backend error so the caller can fall back to
 * the non-streaming checkCompliance().
 */
export async function streamCheck(
  product_description: string,
  product_type: ProductType,
  tone: "simple" | "executive" | "technical",
  lang: "ar" | "en",
  corpora: Corpus[] | undefined,
  handlers: StreamHandlers
): Promise<ComplianceResult> {
  const response = await fetch("/api/check-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_description, product_type, tone, lang, corpora })
  });
  if (!response.ok || !response.body) throw new Error(`stream unavailable (${response.status})`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ComplianceResult | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = JSON.parse(line.slice(5).trim());
    if (payload.event === "retrieved") handlers.onRetrieved?.(payload.articles as RetrievedArticle[]);
    else if (payload.event === "retrieved_ar") handlers.onRetrievedAr?.(payload.titles as string[]);
    else if (payload.event === "finding") handlers.onFinding?.(payload.finding as Finding);
    else if (payload.event === "complete") result = payload.result as ComplianceResult;
    else if (payload.event === "error") throw new Error(payload.detail ?? "stream error");
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (chunk) handleLine(chunk);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!result) throw new Error("stream ended without a result");
  return result;
}

export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return null;
    return (await response.json()) as HealthInfo;
  } catch {
    return null;
  }
}

export async function downloadPdfReport(
  result: ComplianceResult,
  lang: "ar" | "en",
  product_label: string,
  interview: { question: string; answer: string }[] = [],
  session_ref = ""
): Promise<void> {
  const response = await fetch("/api/report-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, lang, product_label, interview, session_ref })
  });
  if (!response.ok) throw new Error(`pdf export failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "complyx-report.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

export async function askConsultant(
  query: string,
  messages: { role: "user" | "assistant"; content: string }[],
  context?: ChatSessionContext
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, messages, context })
  });
  if (!response.ok) throw new Error("تعذر إرسال الاستشارة");
  return response.json() as Promise<{ answer: string }>;
}
