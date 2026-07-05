import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return Response.json(
      { detail: "BACKEND_URL is not configured — start the FastAPI backend and set BACKEND_URL." },
      { status: 503 },
    );
  }

  const body = await request.json();
  try {
    const res = await fetch(`${BACKEND_URL}/api/check/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      return Response.json(err, { status: res.status });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[/api/check-stream] Backend unreachable:", e);
    return Response.json({ detail: "Compliance backend is unreachable." }, { status: 502 });
  }
}
