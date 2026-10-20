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
  const tableId = process.env.N8N_USER_CONTROLS_TABLE_ID || "pS2jwzLkwHQ8or3w";
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ updated: false, error: "n8n API is not configured on the server." }, { status: 503, headers: privateJsonHeaders });
  }

  try {
    const url = new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows/upsert`, baseUrl);
    const paused = action === "pause";
    const response = await fetch(url, {
      method: "POST",
      headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        filter: { type: "and", filters: [{ columnName: "client_id", condition: "eq", value: clientId }] },
        data: {
          client_id: clientId,
          ai_paused: paused,
          paused_by: "dashboard_admin",
          paused_at: paused ? new Date().toISOString() : null,
          reason: paused ? "Paused from Aarohi dashboard" : "Resumed from Aarohi dashboard"
        },
        returnData: true
      }),
      cache: "no-store"
    });
    const raw = await response.text();
    let result: any = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) {
      return NextResponse.json({ updated: false, error: "Could not update AI control state in n8n.", detail: result.message || result.error || raw.slice(0, 200) }, { status: 502, headers: privateJsonHeaders });
    }
    return NextResponse.json({ updated: true, clientId, paused, result }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ updated: false, error: error instanceof Error ? error.message : "AI control update failed." }, { status: 502, headers: privateJsonHeaders });
  }
}
