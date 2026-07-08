import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!BACKEND_URL) {
    return NextResponse.json(
      { detail: "BACKEND_URL is not configured. Start the FastAPI backend and set BACKEND_URL." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/retone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (res.ok) return NextResponse.json(await res.json());
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  } catch (e) {
    console.error("[/api/retone] Backend unreachable:", e);
    return NextResponse.json(
      { detail: "Compliance backend is unreachable." },
      { status: 502 },
    );
  }
}
