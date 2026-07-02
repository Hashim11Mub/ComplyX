import { NextRequest, NextResponse } from "next/server";
import { mockCheckCompliance } from "@/lib/mockCompliance";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  console.log("[check] BACKEND_URL =", BACKEND_URL ?? "NOT SET - using mock");
  const body = await request.json();

  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) return NextResponse.json(await res.json());
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(err, { status: res.status });
    } catch (e) {
      console.error("[/api/check] Backend unreachable, falling back to mock:", e);
    }
  }

  return NextResponse.json(mockCheckCompliance(body.product_description, body.product_type));
}
