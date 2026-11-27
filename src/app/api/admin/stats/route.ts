import { NextResponse } from "next/server";
import { getSession, jsonError, privateJsonHeaders, sameName } from "@/lib/auth";
import { TEAM_APPS } from "@/lib/brand";
import { rangeFor, loadData, accounts, trades, leads } from "@/lib/admin-data";
import { listMembers } from "@/lib/team";

export const dynamic = "force-dynamic";

// Ashish Team master admin dashboard numbers (Aarohi only). ?range=today|yesterday|7d|month|custom&from=&to=
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "master") return jsonError("Sirf admin", 403);
  const u = new URL(req.url);
  const r = rangeFor(String(u.searchParams.get("range") || "today"), u.searchParams.get("from") || "", u.searchParams.get("to") || "");
  const t0 = Date.now();
  try {
    const [{ clients, history }, members] = await Promise.all([loadData(r, u.searchParams.get("fresh") === "1"), listMembers()]);
    const acc = accounts(clients, r);
    const tr = trades(history, r);
    const byApp: Record<string, number> = Object.fromEntries(TEAM_APPS.map(([, a]) => [a, 0]));
    const byTask = [0, 0, 0];
    for (const a of acc) { byApp[a.app] = (byApp[a.app] || 0) + 1; byTask[Math.min(2, a.taskNo - 1)]++; }
    const ev = (e: string) => tr.filter(x => x.event === e).length;
    const bonusRows = clients.filter(c => String(c.bonus_status || ""));
    const active = bonusRows.filter(c => !["done", "not_interested"].includes(String(c.trade_status || "")));
    const names = new Map<string, string>();
    for (const m of members) names.set(m.name.toLowerCase(), m.name);
    for (const c of clients) { const a = String(c.assigned_to || "").trim(); if (a && !names.has(a.toLowerCase())) names.set(a.toLowerCase(), a); }
    for (const x of tr) if (x.by && !names.has(x.by.toLowerCase())) names.set(x.by.toLowerCase(), x.by);
    const today = rangeFor("today");
    const todayDone = (n: string) => trades(history, today).filter(x => x.event === "done" && sameName(x.by, n)).length;
    const perMember = [...names.values()].sort((a, b) => a.localeCompare(b)).map(n => ({
      name: n,
      assigned: active.filter(c => sameName(String(c.assigned_to || ""), n)).length,
      payment: tr.filter(x => x.event === "payment_sent" && sameName(x.by, n)).length,
      done: tr.filter(x => x.event === "done" && sameName(x.by, n)).length,
      notInt: tr.filter(x => x.event === "not_interested" && sameName(x.by, n)).length,
      target: members.find(m => sameName(m.name, n))?.target || 0,
      todayDone: todayDone(n),
      lastLogin: members.find(m => sameName(m.name, n))?.lastLogin || "",
    }));
    const body = {
      range: r,
      leads: leads(clients, r),
      accounts: { total: acc.length, byApp, byTask, apps: TEAM_APPS.map(([, a]) => a) },
      trade: { payment: ev("payment_sent"), done: ev("done"), notInt: ev("not_interested"), backToList: ev("back_to_tq") },
      bonus: { total: bonusRows.length, replied: bonusRows.filter(c => c.bonus_status === "step2").length, noReply: bonusRows.filter(c => c.bonus_status === "step1").length, active: active.length, unassigned: active.filter(c => !String(c.assigned_to || "").trim()).length },
      members: perMember,
      ms: Date.now() - t0,
    };
    console.log(`[admin-stats] ${r.from}..${r.to} ${Date.now() - t0} ms clients=${clients.length} history=${history.length}`);
    return NextResponse.json(body, { headers: privateJsonHeaders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 502, headers: privateJsonHeaders });
  }
}
