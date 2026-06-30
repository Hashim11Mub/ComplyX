import { NextRequest, NextResponse } from "next/server";
import { mockCheckCompliance } from "@/lib/mockCompliance";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json(mockCheckCompliance(body.product_description, body.product_type));
}
