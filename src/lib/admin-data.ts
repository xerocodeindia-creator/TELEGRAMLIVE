import { n8nConfig, readRows, type Row } from "@/lib/n8n";
import { TRADE_HISTORY_TABLE } from "@/lib/trade-history";
import { toMillis } from "@/lib/mappers";
import { TEAM_APPS, OLD_TASK3_APP } from "@/lib/brand";

/** Aarohi: Task 3 was Bajaj unless the user's completed tasks say HDFC SKY (task_3_hdfc) or task_order is v3. */
const col3Old = (c: Row) => !String(c.completed_tasks || "").includes("task_3_hdfc") && String(c.task_order || "") !== "v3";

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

const APPS = TEAM_APPS;

// Speed (28 Nov 2026): one shared data set covers every range button (this month + last 7 days), read in parallel
// (one small query per day + per task/bonus column instead of ~14 pages one after another), kept 2 min, and refreshed
// in the background (stale-while-revalidate + keep-warm ping), so Aaj / Kal / 7 din / Mahina open at once.
type Data = { from: string; at: number; clients: Row[]; history: Row[] };
let data: Data | null = null;
let loadingP: Promise<Data> | null = null;

async function pool<T>(jobs: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
  return out;
}

async function readClients(from: string): Promise<Row[]> {
  const cfg = n8nConfig();
  const startIso = new Date(dayStartUtc(from)).toISOString();
  const today = istDay(Date.now());
  const filters: object[] = [];
  for (let t = dayStartUtc(from); istDay(t) <= today; t += DAY) {
    filters.push({ type: "and", filters: [
      { columnName: "createdAt", condition: "gte", value: new Date(t).toISOString() },
      { columnName: "createdAt", condition: "lt", value: new Date(t + DAY).toISOString() },
    ] });
  }
  for (const [c] of APPS) filters.push({ type: "and", filters: [{ columnName: c, condition: "gte", value: startIso }] });
  filters.push({ type: "and", filters: [{ columnName: "bonus_status", condition: "isNotEmpty", value: null }] });
  filters.push({ type: "and", filters: [{ columnName: "assigned_to", condition: "isNotEmpty", value: null }] });
  const parts = await pool(filters.map(f => () => readRows(cfg.tables.clients, { filter: f, max: 20000 })), 10);
  const byId = new Map<string, Row>();
  for (const rows of parts) for (const r of rows) byId.set(String(r.client_id ?? r.id), r);
  return [...byId.values()];
}

async function readAll(from: string): Promise<Data> {
  const t0 = Date.now();
  const months = new Set<string>();
  for (let t = dayStartUtc(from); t <= Date.now(); t += DAY) months.add(istDay(t).slice(0, 7));
  const histFilter = { type: "or", filters: [...months].map(m => ({ columnName: "month", condition: "eq", value: m })) };
  const [clients, history] = await Promise.all([
    readClients(from),
    readRows(TRADE_HISTORY_TABLE, { filter: histFilter, max: 20000 }).catch(() => [] as Row[]),
  ]);
  console.log(`[admin-data] read from ${from}: clients=${clients.length} history=${history.length} ${Date.now() - t0} ms`);
  return { from, at: Date.now(), clients, history };
}

/** Earliest day any range button needs: start of this month or 6 days ago, whichever is earlier. */
const coverFrom = () => { const m = rangeFor("month").from, w = rangeFor("7d").from; return m < w ? m : w; };

function refresh(from: string) {
  if (!loadingP) loadingP = readAll(from).then(d => { data = d; return d; }).finally(() => { loadingP = null; });
  return loadingP;
}

/** After the admin gives users to members: change the kept copy too, so the dashboard shows it at once. */
export function patchAssigned(changes: Map<string, string>) {
  if (!data) return;
  for (const r of data.clients) { const id = String(r.client_id ?? ""); if (changes.has(id)) r.assigned_to = changes.get(id); }
}

/** Warm the shared data in the background (keep-warm ping). */
export function warmAdmin() { if (!data || Date.now() - data.at > 90000) return refresh(coverFrom()).then(() => undefined); return Promise.resolve(); }

export async function loadData(r: Range, fresh = false): Promise<{ clients: Row[]; history: Row[] }> {
  const need = r.from < coverFrom() ? r.from : coverFrom();
  if (fresh) return refresh(data && data.from < need ? data.from : need);
  if (data && data.from <= need) {
    if (Date.now() - data.at > 120000) refresh(data.from).catch(() => undefined); // answer now, update in background
    return data;
  }
  return refresh(need);
}

export const inRange = (t: number, r: Range) => { if (!t) return false; const d = istDay(t); return d >= r.from && d <= r.to; };

export type AccountRow = { t: number; name: string; id: string; phone: string; app: string; taskNo: number; assigned: string };
export function accounts(clients: Row[], r: Range): AccountRow[] {
  const out: AccountRow[] = [];
  for (const c of clients) {
    const id = String(c.client_id || "");
    if (!/^\d+$/.test(id)) continue;
    const oldT3 = OLD_TASK3_APP && col3Old(c);
    const done = APPS.map(([col, app]) => ({ t: toMillis(c[col]), app: oldT3 && col === "task_3_completed_at" ? OLD_TASK3_APP : app })).filter(x => x.t).sort((a, b) => a.t - b.t);
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
