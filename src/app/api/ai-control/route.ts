import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";

export async function POST(req: Request) {
  if (!await requireAdmin()) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  const action = String(body.action || "");
  if (!/^\d{1,24}$/.test(clientId)) return jsonError("Invalid Telegram user ID");
  if (action !== "pause" && action !== "resume") return jsonError("Action must be pause or resume");
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const tableId = process.env.N8N_USER_CONTROLS_TABLE_ID;
  if (!baseUrl || !apiKey || !tableId) {
    return NextResponse.json({
      updated: false,
      error: "AI control storage is not configured. Create the user_controls data table, configure N8N_USER_CONTROLS_TABLE_ID, and add the control check to the live n8n message route before enabling this button."
    }, { status: 503, headers: privateJsonHeaders });
  }
  return NextResponse.json({
    updated: false,
    error: "Control-table upsert adapter is intentionally not enabled until the user_controls table schema and n8n pause guard are validated. No change was made."
  }, { status: 503, headers: privateJsonHeaders });
}
