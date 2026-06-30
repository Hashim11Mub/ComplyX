import { NextRequest, NextResponse } from "next/server";
import { mockConsultation } from "@/lib/mockCompliance";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json(mockConsultation(body.query));
}
