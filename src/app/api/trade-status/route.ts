import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, upsertByClientId, findByColumn } from "@/lib/n8n";
import { logTradeEvent } from "@/lib/trade-history";

export const dynamic = "force-dynamic";

// Team app (Aisha and Aarohi): mark a Trade Qualified user as "done" (trade completed) or "not_interested",
// or clear it ("") to put the user back in the Trade Qualified list. Stored on aisha_client_progress.
const ALLOWED = new Set(["done", "not_interested", "payment_sent", ""]);

export async function POST(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);
  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const status = String(body.status ?? "").trim();
  const by = String(body.by || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!/^\d{1,24}$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (!ALLOWED.has(status)) return jsonError("Invalid status");
  const cfg = n8nConfig();
  try {
    // Only existing users can be marked (upsert must never create a new progress row).
    const row = await findByColumn(cfg.tables.clients, "client_id", chatId);
    if (!row) return jsonError("User nahi mila", 404);
    const at = status ? new Date().toISOString() : "";
    await upsertByClientId(cfg.tables.clients, chatId, { trade_status: status, trade_status_at: at, trade_status_by: status ? by : "" });
    await logTradeEvent(chatId, String(row.first_name || ""), status || "back_to_tq", status ? String(row.trade_campaign || "") : "", by, at || new Date().toISOString());
    console.log(`[trade-status] ${chatId} -> "${status}" by "${by}"`);
    return NextResponse.json({ ok: true, chatId, status, at, by: status ? by : "" }, { headers: privateJsonHeaders });
  } catch (error) {
    console.log(`[trade-status] ERROR ${chatId}: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Save nahi hua", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }
}
