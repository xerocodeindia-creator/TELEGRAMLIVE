import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows, type Row } from "@/lib/n8n";
import { toMillis, mapMessage } from "@/lib/mappers";
import { IS_AISHA } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Aisha team app: the Trade Qualified list only (same rule as the dashboard filter):
// bonus campaign users + users whose first Choice / HDFC SKY account was approved this month (IST).
// Small and fast: two filtered reads instead of the full dashboard load.
const IST = 5.5 * 3600 * 1000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
let cache: { at: number; body: unknown } | null = null;

// Recent messages (last 72 h) kept on a warm server instance: the first request reads the window once,
// every later request only reads rows newer than the last id (usually one small page).
const WINDOW = 72 * 3600 * 1000;
type MsgState = { rows: Map<number, Row>; maxId: number; at: number };
let msgState: MsgState | null = null;
let msgLoading: Promise<MsgState> | null = null;

async function recentMessages(tableId: string, paths: string[]): Promise<Row[]> {
  const since = Date.now() - WINDOW;
  const fresh = msgState && Date.now() - msgState.at < 10 * 60 * 1000 ? msgState : null;
  if (fresh) {
    const newer = await readRows(tableId, { pageSize: 100, max: 5000, stop: row => Number(row.id) <= fresh.maxId });
    for (const r of newer) { fresh.rows.set(Number(r.id), r); if (Number(r.id) > fresh.maxId) fresh.maxId = Number(r.id); }
    for (const [id, r] of fresh.rows) if (toMillis(r.createdAt) < since) fresh.rows.delete(id);
    fresh.at = Date.now();
    paths.push(`msgs:+${newer.length}`);
    return [...fresh.rows.values()];
  }
  if (!msgLoading) {
    msgLoading = (async () => {
      const rows = await readRows(tableId, { max: 40000, stop: row => toMillis(row.createdAt) < since });
      const map = new Map<number, Row>();
      let maxId = 0;
      for (const r of rows) { map.set(Number(r.id), r); maxId = Math.max(maxId, Number(r.id) || 0); }
      msgState = { rows: map, maxId, at: Date.now() };
      return msgState;
    })().finally(() => { msgLoading = null; });
  }
  const st = await msgLoading;
  paths.push(`msgs:cold`);
  return [...st.rows.values()];
}

export async function GET(req: Request) {
  if (!IS_AISHA) return jsonError("Not available", 404);
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (!fresh && cache && Date.now() - cache.at < 3000) return NextResponse.json(cache.body, { headers: privateJsonHeaders });
  const cfg = n8nConfig();
  const t0 = Date.now();
  const paths: string[] = [];
  const monthKey = istDay(Date.now()).slice(0, 8) + "01";
  const monthStartIso = new Date(Date.parse(monthKey + "T00:00:00Z") - IST).toISOString();
  try {
    const clientsFilter = { type: "or", filters: [
      { columnName: "bonus_status", condition: "isNotEmpty", value: null },
      { columnName: "task_1_completed_at", condition: "gte", value: monthStartIso },
      { columnName: "task_2_completed_at", condition: "gte", value: monthStartIso },
    ] };
    // Filtered reads are small; if this n8n version rejects a filter, fall back to plain reads (same result, slower).
    const [clientRows, msgRows] = await Promise.all([
      readRows(cfg.tables.clients, { filter: clientsFilter, max: 5000 }).catch(e => { paths.push("clients-fallback:" + String(e).slice(0, 120)); return readRows(cfg.tables.clients, {}); }),
      recentMessages(cfg.tables.messages, paths),
    ]);
    const byChat = new Map<string, ReturnType<typeof mapMessage>[]>();
    for (const r of msgRows) {
      const m = mapMessage(r);
      if (!/^\d+$/.test(m.chatId)) continue;
      if (!byChat.has(m.chatId)) byChat.set(m.chatId, []);
      byChat.get(m.chatId)!.push(m);
    }
    type TqUser = { id: string; name: string; phone: string; apps: string[]; bonus: string; tradeStatus: string; tradeStatusAt: string; tradeStatusBy: string; tradeCampaign: string; last: { text: string; direction: string; time: string } | null; lastTime: number; unread: number };
    const users: TqUser[] = [];
    for (const r of clientRows as Row[]) {
      const id = String(r.client_id || "");
      if (!/^\d+$/.test(id)) continue;
      let completed: string[] = [];
      try { const v = JSON.parse(String(r.completed_tasks || "[]")); if (Array.isArray(v)) completed = v.map(String); } catch {}
      const bonus = String(r.bonus_status || "");
      const ts = [r.task_1_completed_at, r.task_2_completed_at].map(toMillis).filter(Boolean);
      const tqDay = ts.length ? istDay(Math.min(...ts)) : "";
      const qualifiedThisMonth = !!tqDay && tqDay >= monthKey && completed.some(t => t === "task_1_angel_one" || t === "task_2_choice_finx");
      if (!bonus && !qualifiedThisMonth) continue;
      const list = (byChat.get(id) || []).sort((a, b) => a.id - b.id);
      const last = list[list.length - 1];
      let lastOut = -1;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].direction !== "in") { lastOut = i; break; }
      const unread = list.slice(lastOut + 1).filter(m => m.direction === "in").length;
      users.push({
        id,
        name: String(r.first_name || "Telegram user"),
        phone: r.phone_number ? String(r.phone_number) : "",
        apps: [completed.includes("task_2_choice_finx") ? "Choice" : "", completed.includes("task_1_angel_one") ? "HDFC" : "", completed.includes("task_3") ? "Bajaj" : ""].filter(Boolean),
        bonus,
        // "" = in the Trade Qualified list; "done" / "not_interested" = moved out by the team.
        tradeStatus: String(r.trade_status || ""),
        tradeStatusAt: String(r.trade_status_at || ""),
        tradeStatusBy: String(r.trade_status_by || ""),
        tradeCampaign: String(r.trade_campaign || ""),
        last: last ? { text: last.text || (last.fileId ? "📷 Photo" : ""), direction: last.direction, time: last.time } : null,
        lastTime: last ? toMillis(last.time) : toMillis(r.updatedAt),
        unread,
      });
    }
    users.sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || b.lastTime - a.lastTime);
    const body = { users, month: monthKey, serverTime: new Date().toISOString() };
    const cnt = (st: string) => users.filter(u => u.tradeStatus === st).length;
    console.log(`[tq] ${Date.now() - t0} ms fresh=${fresh} clients=${clientRows.length} messages=${msgRows.length} users=${users.length} tq=${cnt("")} done=${cnt("done")} notint=${cnt("not_interested")} payment=${cnt("payment_sent")} ${paths.join(" ")}`);
    cache = { at: Date.now(), body };
    return NextResponse.json(body, { headers: privateJsonHeaders });
  } catch (error) {
    console.log(`[tq] ERROR after ${Date.now() - t0} ms: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: error instanceof Error ? error.message : "n8n error" }, { status: 502, headers: privateJsonHeaders });
  }
}
