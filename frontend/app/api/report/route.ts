import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({
    filename: "complyx-report.html",
    message: "Frontend-only prototype: report export is generated in the browser.",
    score: body.compliance_score
  });
}
