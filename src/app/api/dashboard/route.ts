import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows, GLOBAL_CONTROL_ID, type Row } from "@/lib/n8n";
import { toMillis, mapMessage } from "@/lib/mappers";
import { msgCmp } from "@/lib/ui";
import { IS_AISHA } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Initial load: recent message history + all clients. After that the page asks only for
// rows newer than its cursor (sinceId / clientsSince), so each poll is a tiny request.
const FULL_MESSAGES = 4000;

function mapClient(r: Row) {
  let completed: string[] = [];
  try { const v = JSON.parse(String(r.completed_tasks || "[]")); if (Array.isArray(v)) completed = v.map(String); } catch {}
  // Aarohi v3 users finish HDFC SKY as "task_3_hdfc"; the dashboard shows it in the Task 3 slot.
  if (!IS_AISHA && completed.includes("task_3_hdfc") && !completed.includes("task_3")) completed.push("task_3");
  let skipped: string[] = [];
  try { const v = JSON.parse(String(r.skipped_tasks || "[]")); if (Array.isArray(v)) skipped = v.map(String); } catch {}
  return {
    id: String(r.client_id || ""),
    name: String(r.first_name || "Telegram user"),
    phone: r.phone_number ? String(r.phone_number) : "",
    flowStep: String(r.flow_step || ""),
    currentTask: String(r.current_task || ""),
    proofStatus: String(r.proof_status || ""),
    completed,
    skipped,
    taskOrder: r.task_order ? String(r.task_order) : "",
    bonus: r.bonus_status ? String(r.bonus_status) : "",
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

// Aisha: a warm server instance keeps the last full snapshot, so opening the dashboard again only needs
// the rows that changed since then (a few small requests) instead of ~35 sequential n8n page reads.
type Snapshot = { messages: Row[]; maxId: number; clients: Map<string, Row>; clientsStamp: number; at: number };
let snapshot: Snapshot | null = null;
const SNAPSHOT_TTL = 30 * 60 * 1000;

async function aishaFull() {
  const t0 = Date.now();
  const cfg = n8nConfig();
  const snap = snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL ? snapshot : null;
  const controlsPromise = readRows(cfg.tables.controls, { max: 5000 });
  let messages: Row[], clients: Map<string, Row>, maxId: number, clientsStamp: number, cached = false;
  if (snap) {
    const [newMsgs, changed] = await Promise.all([
      readRows(cfg.tables.messages, { max: 4000, pageSize: 100, stop: row => Number(row.id) <= snap.maxId }),
      readRows(cfg.tables.clients, { sortBy: "updatedAt:desc", pageSize: 100, max: 5000, stop: row => toMillis(row.updatedAt) < snap.clientsStamp }),
    ]);
    const byId = new Map<number, Row>(snap.messages.map(r => [Number(r.id), r]));
    for (const r of newMsgs) byId.set(Number(r.id), r);
    messages = [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, FULL_MESSAGES);
    clients = new Map(snap.clients);
    for (const r of changed) clients.set(String(r.client_id || ""), r);
    cached = true;
  } else {
    const [m, c] = await Promise.all([readRows(cfg.tables.messages, { max: FULL_MESSAGES }), readRows(cfg.tables.clients, {})]);
    messages = m;
    clients = new Map(c.map(r => [String(r.client_id || ""), r]));
  }
  maxId = messages.reduce((acc, r) => Math.max(acc, Number(r.id) || 0), 0);
  clientsStamp = [...clients.values()].reduce((acc, r) => Math.max(acc, toMillis(r.updatedAt)), 0);
  snapshot = { messages, maxId, clients, clientsStamp, at: Date.now() };
  const controlRows = await controlsPromise;
  console.log(`[dashboard] full load ${cached ? "from snapshot" : "cold"} in ${Date.now() - t0} ms (${messages.length} messages, ${clients.size} clients)`);
  return { messageRows: messages, clientRows: [...clients.values()], controlRows, maxId, clientsStamp };
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
    if (full) {
      const { messageRows, clientRows, controlRows, maxId, clientsStamp } = await aishaFull();
      const messages = messageRows
        .filter(m => m && (m.chat_id != null || m.user_id != null))
        .map(mapMessage)
        .filter(m => /^\d+$/.test(m.chatId))
        .sort(msgCmp);
      const clients = clientRows.map(mapClient).filter(c => /^\d+$/.test(c.id));
      return NextResponse.json({
        connected: true,
        full: true,
        clientsFull: true,
        messages,
        clients,
        controls: mapControls(controlRows),
        cursor: { sinceId: maxId, clientsSince: clientsStamp ? new Date(clientsStamp).toISOString() : "" },
        serverTime: new Date().toISOString(),
      }, { headers: privateJsonHeaders });
    }
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
