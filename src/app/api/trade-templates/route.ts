import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { TRADE_TEMPLATES } from "@/lib/trade-templates";

export const dynamic = "force-dynamic";

// Team app (Aisha and Aarohi): trade campaigns and their "after payment" message.
export async function GET() {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  return NextResponse.json({ templates: TRADE_TEMPLATES }, { headers: privateJsonHeaders });
}
