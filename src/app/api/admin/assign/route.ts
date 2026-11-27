import { NextResponse } from "next/server";
import { getSession, jsonError, privateJsonHeaders, sameName } from "@/lib/auth";
import { n8nConfig, readRows, upsertByClientId, type Row } from "@/lib/n8n";
import { toMillis } from "@/lib/mappers";
import { patchAssigned } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

// Ashish Team master admin: give bonus users to team members.
//  { members: ["Rahul","Ashu"], scope: "unassigned" | "active" }  → round robin over bonus users not yet Done / Not interested
//  { from: "Rahul", to: "Ashu" }                                   → move all of Rahul's active users to Ashu
//  { clear: true, members?: [...] }                                → take active users back (everyone sees them again)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "master") return jsonError("Sirf admin", 403);
  const b = await req.json().catch(() => ({}));
  const cfg = n8nConfig();
  const t0 = Date.now();
  const rows = await readRows(cfg.tables.clients, { filter: { type: "and", filters: [{ columnName: "bonus_status", condition: "isNotEmpty", value: null }] }, max: 20000 });
  const active = rows.filter(r => /^\d+$/.test(String(r.client_id || "")) && !["done", "not_interested"].includes(String(r.trade_status || "")))
    .sort((a, b2) => toMillis(b2.updatedAt) - toMillis(a.updatedAt));
  const plan: [Row, string][] = [];
  const members: string[] = Array.isArray(b.members) ? b.members.map((x: unknown) => String(x).replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean) : [];
  if (b.from && b.to) {
    const from = String(b.from), to = String(b.to).trim().slice(0, 40);
    for (const r of active) if (sameName(String(r.assigned_to || ""), from)) plan.push([r, to]);
  } else if (b.clear === true) {
    for (const r of active) if (String(r.assigned_to || "") && (!members.length || members.some(m => sameName(m, String(r.assigned_to))))) plan.push([r, ""]);
  } else {
    if (!members.length) return jsonError("Kam se kam ek team member chuno");
    const pool = b.scope === "active" ? active : active.filter(r => !String(r.assigned_to || "").trim());
    pool.forEach((r, i) => plan.push([r, members[i % members.length]]));
  }
  let ok = 0, failed = 0;
  for (let i = 0; i < plan.length; i += 15) {
    await Promise.all(plan.slice(i, i + 15).map(([r, to]) => upsertByClientId(cfg.tables.clients, String(r.client_id), { assigned_to: to }).then(() => ok++, () => failed++)));
  }
  patchAssigned(new Map(plan.map(([r, to]) => [String(r.client_id), to])));
  const counts: Record<string, number> = {};
  for (const [, to] of plan) counts[to || "(koi nahi)"] = (counts[to || "(koi nahi)"] || 0) + 1;
  console.log(`[admin-assign] ${plan.length} users ok=${ok} failed=${failed} ${Date.now() - t0} ms ${JSON.stringify(counts)}`);
  return NextResponse.json({ changed: ok, failed, counts }, { headers: privateJsonHeaders });
}
