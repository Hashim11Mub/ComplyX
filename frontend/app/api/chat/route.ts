import { NextRequest, NextResponse } from "next/server";
import { mockConsultation } from "@/lib/mockCompliance";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch (e) {
      console.error("[/api/chat] Backend unreachable, falling back to mock:", e);
    }
  }

  return NextResponse.json(mockConsultation(body.query));
}
