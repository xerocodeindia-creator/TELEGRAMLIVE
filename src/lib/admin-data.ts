import { n8nConfig, readRows, type Row } from "@/lib/n8n";
import { TRADE_HISTORY_TABLE } from "@/lib/trade-history";
import { toMillis } from "@/lib/mappers";

// Ashish Team master admin (Aarohi): numbers for a date range in IST. 27 Nov 2026.
const IST = 5.5 * 3600 * 1000, DAY = 86400000;
export const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
const dayStartUtc = (d: string) => Date.parse(d + "T00:00:00Z") - IST;

export type Range = { from: string; to: string; label: string };
export function rangeFor(key: string, from?: string, to?: string): Range {
  const today = istDay(Date.now());
  const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (key === "custom" && ok(from) && ok(to)) return from! <= to! ? { from: from!, to: to!, label: `${from} se ${to}` } : { from: to!, to: from!, label: `${to} se ${from}` };
  if (key === "yesterday") { const y = istDay(Date.now() - DAY); return { from: y, to: y, label: "Kal" }; }
  if (key === "7d") return { from: istDay(Date.now() - 6 * DAY), to: today, label: "7 din" };
  if (key === "month") return { from: today.slice(0, 8) + "01", to: today, label: "Is mahina" };
  return { from: today, to: today, label: "Aaj" };
}

const APPS: [string, string][] = [["task_1_completed_at", "Angel One"], ["task_2_completed_at", "Choice FinX"], ["task_3_completed_at", "Bajaj"]];

let rowsCache: { key: string; at: number; clients: Row[]; history: Row[] } | null = null;

export async function loadData(r: Range) {
  const key = r.from + r.to;
  if (rowsCache && rowsCache.key === key && Date.now() - rowsCache.at < 30000) return rowsCache;
  const cfg = n8nConfig();
  const startIso = new Date(dayStartUtc(r.from)).toISOString();
  const filter = { type: "or", filters: [
    ...APPS.map(([c]) => ({ columnName: c, condition: "gte", value: startIso })),
    { columnName: "createdAt", condition: "gte", value: startIso },
    { columnName: "bonus_status", condition: "isNotEmpty", value: null },
    { columnName: "assigned_to", condition: "isNotEmpty", value: null },
  ] };
  const months = new Set<string>();
  for (let t = dayStartUtc(r.from); t <= dayStartUtc(r.to); t += DAY) months.add(istDay(t).slice(0, 7));
  const histFilter = { type: "or", filters: [...months].map(m => ({ columnName: "month", condition: "eq", value: m })) };
  const [clients, history] = await Promise.all([
    readRows(cfg.tables.clients, { filter, max: 20000 }),
    readRows(TRADE_HISTORY_TABLE, { filter: histFilter, max: 20000 }).catch(() => [] as Row[]),
  ]);
  rowsCache = { key, at: Date.now(), clients, history };
  return rowsCache;
}

export const inRange = (t: number, r: Range) => { if (!t) return false; const d = istDay(t); return d >= r.from && d <= r.to; };

export type AccountRow = { t: number; name: string; id: string; phone: string; app: string; taskNo: number; assigned: string };
export function accounts(clients: Row[], r: Range): AccountRow[] {
  const out: AccountRow[] = [];
  for (const c of clients) {
    const id = String(c.client_id || "");
    if (!/^\d+$/.test(id)) continue;
    const done = APPS.map(([col, app]) => ({ t: toMillis(c[col]), app })).filter(x => x.t).sort((a, b) => a.t - b.t);
    done.forEach((x, i) => {
      if (inRange(x.t, r)) out.push({ t: x.t, name: String(c.first_name || ""), id, phone: String(c.phone_number || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""), app: x.app, taskNo: i + 1, assigned: String(c.assigned_to || "") });
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

export type TradeRow = { t: number; name: string; id: string; event: string; by: string; campaign: string };
export function trades(history: Row[], r: Range): TradeRow[] {
  return history.map(h => ({ t: toMillis(h.at), name: String(h.name || ""), id: String(h.client_id || ""), event: String(h.event || ""), by: String(h.by || ""), campaign: String(h.campaign || "") }))
    .filter(x => inRange(x.t, r)).sort((a, b) => a.t - b.t);
}

export const leads = (clients: Row[], r: Range) => clients.filter(c => /^\d+$/.test(String(c.client_id || "")) && inRange(toMillis(c.createdAt), r)).length;
