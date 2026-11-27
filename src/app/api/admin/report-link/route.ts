import { NextResponse } from "next/server";
import { getSession, jsonError, privateJsonHeaders } from "@/lib/auth";
import { IS_AISHA } from "@/lib/brand";
import { makeReportToken } from "@/lib/report-token";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "master" || IS_AISHA) return jsonError("Sirf admin", 403);
  const u = new URL(req.url);
  const t = makeReportToken(String(u.searchParams.get("range") || "today"), u.searchParams.get("from") || "", u.searchParams.get("to") || "");
  return NextResponse.json({ url: `${u.origin}/api/admin/report?t=${encodeURIComponent(t)}` }, { headers: privateJsonHeaders });
}
