import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows, GLOBAL_CONTROL_ID, type Row } from "@/lib/n8n";
import { toMillis, mapMessage } from "@/lib/mappers";
import { msgCmp } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Initial load: recent message history + all clients. After that the page asks only for
// rows newer than its cursor (sinceId / clientsSince), so each poll is a tiny request.
const FULL_MESSAGES = 4000;

function mapClient(r: Row) {
  let completed: string[] = [];
  try { const v = JSON.parse(String(r.completed_tasks || "[]")); if (Array.isArray(v)) completed = v.map(String); } catch {}
  return {
    id: String(r.client_id || ""),
    name: String(r.first_name || "Telegram user"),
    phone: r.phone_number ? String(r.phone_number) : "",
    flowStep: String(r.flow_step || ""),
    currentTask: String(r.current_task || ""),
    proofStatus: String(r.proof_status || ""),
    completed,
    updatedAt: r.updatedAt ? String(r.updatedAt) : "",
    t1: r.task_1_completed_at ? String(r.task_1_completed_at) : "",
    t2: r.task_2_completed_at ? String(r.task_2_completed_at) : "",
    t3: r.task_3_completed_at ? String(r.task_3_completed_at) : "",
  };
}

function mapControls(rows: Row[]) {
  let global = { paused: false, at: "" };
  const users: Record<string, { paused: boolean; noKyc: boolean; humanReply: boolean }> = {};
  for (const row of rows) {
    const id = String(row.client_id || "");
    const paused = row.ai_paused === true || String(row.ai_paused) === "true";
    if (id === GLOBAL_CONTROL_ID) { global = { paused, at: String(row.paused_at || row.updatedAt || "") }; continue; }
    if (!/^\d+$/.test(id)) continue;
    users[id] = { paused, noKyc: paused && String(row.reason || "").startsWith("NO_KYC"), humanReply: paused && String(row.reason || "").startsWith("HUMAN_REPLY") };
  }
  return { global, users };
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const cfg = n8nConfig();
  if (!cfg.configured) return NextResponse.json({ connected: false, reason: "n8n_not_configured" }, { headers: privateJsonHeaders });

  const params = new URL(req.url).searchParams;
  const sinceId = Number(params.get("sinceId") || 0);
  const clientsSince = toMillis(params.get("clientsSince"));
  const full = !sinceId;

  try {
    const messagesPromise = full
      ? readRows(cfg.tables.messages, { max: FULL_MESSAGES })
      : readRows(cfg.tables.messages, { max: 2000, pageSize: 100, stop: row => Number(row.id) <= sinceId });

    const clientsPromise = (async () => {
      if (full || !clientsSince) return { rows: await readRows(cfg.tables.clients, {}), full: true };
      try {
        const rows = await readRows(cfg.tables.clients, { sortBy: "updatedAt:desc", pageSize: 50, max: 2000, stop: row => toMillis(row.updatedAt) <= clientsSince });
        return { rows, full: false };
      } catch {
        return { rows: await readRows(cfg.tables.clients, {}), full: true };
      }
    })();

    const [messageRows, clientResult, controlRows] = await Promise.all([
      messagesPromise,
      clientsPromise,
      readRows(cfg.tables.controls, { max: 5000 }),
    ]);

    const messages = messageRows
      .filter(m => m && (m.chat_id != null || m.user_id != null))
      .map(mapMessage)
      .filter(m => /^\d+$/.test(m.chatId))
      .sort(msgCmp);
    const clients = clientResult.rows.map(mapClient).filter(c => /^\d+$/.test(c.id));

    const maxId = messages.reduce((acc, m) => Math.max(acc, m.id), sinceId);
    const maxClientStamp = clientResult.rows.reduce((acc, r) => Math.max(acc, toMillis(r.updatedAt)), clientsSince);

    return NextResponse.json({
      connected: true,
      full,
      clientsFull: clientResult.full,
      messages,
      clients,
      controls: mapControls(controlRows),
      cursor: { sinceId: maxId, clientsSince: maxClientStamp ? new Date(maxClientStamp).toISOString() : "" },
      serverTime: new Date().toISOString(),
    }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ connected: false, reason: "n8n_api_error", error: error instanceof Error ? error.message : "Unknown n8n API error" }, { status: 502, headers: privateJsonHeaders });
  }
}
