import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows, listRows, type Row } from "@/lib/n8n";
import { toMillis, mapMessage } from "@/lib/mappers";
import { IS_AISHA } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Team app (Aisha and Aarohi): the Trade Qualified list only (same rule as the dashboard filter):
// bonus campaign users + users whose first Choice / HDFC SKY account was approved this month (IST).
// Small and fast: two filtered reads instead of the full dashboard load.
const IST = 5.5 * 3600 * 1000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
let cache: { at: number; body: unknown } | null = null;

// Messages per Trade Qualified user (27 Nov 2026): the old version read every message of the last 72 h
// (37k rows after the follow-ups started, 134 s cold) and the app gave up after 60 s, showing 0 users.
// Now: cold = the last PER_CHAT messages of each TQ user (filtered reads, in parallel);
// warm = only rows newer than the last id seen, added to the chats we track.
const PER_CHAT = 15;
type ChatCache = { byChat: Map<string, Row[]>; maxId: number; at: number };
let chatCache: ChatCache | null = null;

async function lastMessagesFor(tableId: string, chatId: string): Promise<Row[]> {
  const { rows } = await listRows(tableId, { limit: PER_CHAT, sortBy: "id:desc", filter: { type: "and", filters: [{ columnName: "chat_id", condition: "eq", value: chatId }] } });
  return rows;
}

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function messagesForChats(tableId: string, chatIds: string[], paths: string[]): Promise<Map<string, Row[]>> {
  const warm = chatCache && Date.now() - chatCache.at < 10 * 60 * 1000 ? chatCache : null;
  if (warm) {
    const newer = await readRows(tableId, { pageSize: 100, max: 5000, sortBy: "id:desc", stop: row => Number(row.id) <= warm.maxId });
    for (const r of newer) {
      const id = String(r.chat_id ?? r.user_id ?? "").trim();
      const list = warm.byChat.get(id);
      if (list) { list.unshift(r); if (list.length > PER_CHAT) list.length = PER_CHAT; }
      if (Number(r.id) > warm.maxId) warm.maxId = Number(r.id);
    }
    const missing = chatIds.filter(id => !warm.byChat.has(id));
    await inBatches(missing, 25, async id => { warm.byChat.set(id, await lastMessagesFor(tableId, id).catch(() => [])); });
    warm.at = Date.now();
    paths.push(`msgs:+${newer.length} new-chats:${missing.length}`);
    return warm.byChat;
  }
  const top = await listRows(tableId, { limit: 1, sortBy: "id:desc" });
  const maxId = Number(top.rows[0]?.id) || 0;
  const byChat = new Map<string, Row[]>();
  await inBatches(chatIds, 25, async id => { byChat.set(id, await lastMessagesFor(tableId, id).catch(() => [])); });
  chatCache = { byChat, maxId, at: Date.now() };
  paths.push(`msgs:cold chats=${chatIds.length}`);
  return byChat;
}

export async function GET(req: Request) {
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
      // Aarohi: any first task counts, Bajaj included.
      ...(IS_AISHA ? [] : [{ columnName: "task_3_completed_at", condition: "gte", value: monthStartIso }]),
    ] };
    // Filtered reads are small; if this n8n version rejects a filter, fall back to plain reads (same result, slower).
    const clientRows = await readRows(cfg.tables.clients, { filter: clientsFilter, max: 5000 }).catch(e => { paths.push("clients-fallback:" + String(e).slice(0, 120)); return readRows(cfg.tables.clients, {}); });
    // Same qualification rule as below, decided first so messages are read only for these users.
    const qualifies = (r: Row) => {
      let done: string[] = [];
      try { const v = JSON.parse(String(r.completed_tasks || "[]")); if (Array.isArray(v)) done = v.map(String); } catch {}
      const ts = (IS_AISHA ? [r.task_1_completed_at, r.task_2_completed_at] : [r.task_1_completed_at, r.task_2_completed_at, r.task_3_completed_at]).map(toMillis).filter(Boolean);
      const day = ts.length ? istDay(Math.min(...ts)) : "";
      return !!r.bonus_status || (!!day && day >= monthKey && done.some(t => t === "task_1_angel_one" || t === "task_2_choice_finx" || (!IS_AISHA && t === "task_3")));
    };
    const tqIds = (clientRows as Row[]).filter(r => /^\d+$/.test(String(r.client_id || "")) && qualifies(r)).map(r => String(r.client_id));
    const rawByChat = await messagesForChats(cfg.tables.messages, tqIds, paths);
    const byChat = new Map<string, ReturnType<typeof mapMessage>[]>();
    for (const id of tqIds) byChat.set(id, (rawByChat.get(id) || []).map(mapMessage));
    const msgCount = [...byChat.values()].reduce((n, l) => n + l.length, 0);
    type TqUser = { id: string; name: string; phone: string; apps: string[]; bonus: string; tradeStatus: string; tradeStatusAt: string; tradeStatusBy: string; tradeCampaign: string; last: { text: string; direction: string; time: string } | null; lastTime: number; unread: number };
    const users: TqUser[] = [];
    for (const r of clientRows as Row[]) {
      const id = String(r.client_id || "");
      if (!/^\d+$/.test(id)) continue;
      let completed: string[] = [];
      try { const v = JSON.parse(String(r.completed_tasks || "[]")); if (Array.isArray(v)) completed = v.map(String); } catch {}
      const bonus = String(r.bonus_status || "");
      const ts = (IS_AISHA ? [r.task_1_completed_at, r.task_2_completed_at] : [r.task_1_completed_at, r.task_2_completed_at, r.task_3_completed_at]).map(toMillis).filter(Boolean);
      const tqDay = ts.length ? istDay(Math.min(...ts)) : "";
      const qualifiedThisMonth = !!tqDay && tqDay >= monthKey && completed.some(t => t === "task_1_angel_one" || t === "task_2_choice_finx" || (!IS_AISHA && t === "task_3"));
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
        apps: (IS_AISHA
          ? [completed.includes("task_2_choice_finx") ? "Choice" : "", completed.includes("task_1_angel_one") ? "HDFC" : "", completed.includes("task_3") ? "Bajaj/Zerodha" : ""]
          : [completed.includes("task_1_angel_one") ? "Angel One" : "", completed.includes("task_2_choice_finx") ? "Choice FinX" : "", completed.includes("task_3") ? "Bajaj" : ""]).filter(Boolean),
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
    console.log(`[tq] ${Date.now() - t0} ms fresh=${fresh} clients=${clientRows.length} messages=${msgCount} users=${users.length} tq=${cnt("")} done=${cnt("done")} notint=${cnt("not_interested")} payment=${cnt("payment_sent")} ${paths.join(" ")}`);
    cache = { at: Date.now(), body };
    return NextResponse.json(body, { headers: privateJsonHeaders });
  } catch (error) {
    console.log(`[tq] ERROR after ${Date.now() - t0} ms: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: error instanceof Error ? error.message : "n8n error" }, { status: 502, headers: privateJsonHeaders });
  }
}
