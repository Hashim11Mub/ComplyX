import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json({ detail: "Backend not configured" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const res = await fetch(`${BACKEND_URL}/api/extract-text`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) return NextResponse.json(await res.json());
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  } catch (e) {
    console.error("[/api/extract-text]", e);
    return NextResponse.json({ detail: "Failed to extract text from file" }, { status: 500 });
  }
}
