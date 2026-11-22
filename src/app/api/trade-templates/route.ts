import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { IS_AISHA } from "@/lib/brand";
import { TRADE_TEMPLATES } from "@/lib/trade-templates";

export const dynamic = "force-dynamic";

// Aisha team app: trade campaigns and their "after payment" message.
export async function GET() {
  if (!IS_AISHA) return jsonError("Not available", 404);
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  return NextResponse.json({ templates: TRADE_TEMPLATES }, { headers: privateJsonHeaders });
}
