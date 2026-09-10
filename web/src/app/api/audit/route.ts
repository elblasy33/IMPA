import { NextResponse } from "next/server";
import { getQualityAudit } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audit = getQualityAudit();
    return NextResponse.json(audit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
