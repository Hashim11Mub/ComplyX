import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return Response.json({ detail: "BACKEND_URL is not configured." }, { status: 503 });
  }

  const body = await request.json();
  try {
    const res = await fetch(`${BACKEND_URL}/api/report-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json(err, { status: res.status });
    }
    const pdf = await res.arrayBuffer();
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="complyx-report.pdf"',
      },
    });
  } catch (e) {
    console.error("[/api/report-pdf] Backend unreachable:", e);
    return Response.json({ detail: "PDF export backend unreachable." }, { status: 502 });
  }
}
