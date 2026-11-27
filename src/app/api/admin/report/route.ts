import { readReportToken } from "@/lib/report-token";
import { IS_AISHA } from "@/lib/brand";
import { rangeFor, loadData, accounts, trades, leads, istDay } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

// Excel (CSV, opens in Excel / Google Sheets) report for the Ashish Team master admin. Link from /api/admin/report-link (10 min).
const IST = 5.5 * 3600 * 1000;
const hm = (t: number) => new Date(t + IST).toISOString().slice(11, 16);
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const EVENT: Record<string, string> = { payment_sent: "Funds / payment bheja", done: "Trade done", not_interested: "Not interested", back_to_tq: "Wapas list mein" };

export async function GET(req: Request) {
  const tok = readReportToken(new URL(req.url).searchParams.get("t") || "");
  if (!tok || IS_AISHA) return new Response("Link expire ho gaya. App se dobara Excel report dabao.", { status: 403 });
  const r = rangeFor(tok.range, tok.from, tok.to);
  const { clients, history } = await loadData(r);
  const acc = accounts(clients, r), tr = trades(history, r);
  const lines: unknown[][] = [];
  lines.push([`Aarohi report — ${r.label} (${r.from} se ${r.to})`]);
  lines.push([]);
  lines.push(["Naye leads", leads(clients, r)]);
  lines.push(["Accounts total", acc.length]);
  for (const app of ["Choice FinX", "Angel One", "Bajaj"]) lines.push([`  ${app}`, acc.filter(a => a.app === app).length]);
  for (let i = 1; i <= 3; i++) lines.push([`  Task ${i}`, acc.filter(a => Math.min(3, a.taskNo) === i).length]);
  lines.push(["Funds / payment bheja", tr.filter(x => x.event === "payment_sent").length]);
  lines.push(["Trade done", tr.filter(x => x.event === "done").length]);
  lines.push(["Not interested", tr.filter(x => x.event === "not_interested").length]);
  lines.push([]);
  lines.push(["Team member", "Funds bheja", "Trade done", "Not interested"]);
  const by = [...new Set(tr.map(x => x.by).filter(Boolean))].sort();
  for (const b of by) lines.push([b, ...["payment_sent", "done", "not_interested"].map(e => tr.filter(x => x.by === b && x.event === e).length)]);
  lines.push([]);
  lines.push(["ACCOUNTS"]);
  lines.push(["Date", "Time", "Naam", "Telegram ID", "Number", "App", "Task no.", "Team member"]);
  for (const a of acc) lines.push([istDay(a.t), hm(a.t), a.name, a.id, a.phone, a.app, a.taskNo, a.assigned]);
  lines.push([]);
  lines.push(["TRADE / FUNDS"]);
  lines.push(["Date", "Time", "Naam", "Telegram ID", "Kya hua", "Kisne kiya", "Campaign"]);
  for (const x of tr) lines.push([istDay(x.t), hm(x.t), x.name, x.id, EVENT[x.event] || x.event, x.by, x.campaign]);
  const csv = "﻿" + lines.map(l => l.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="Aarohi_Report_${r.from}_to_${r.to}.csv"`, "Cache-Control": "no-store" } });
}
