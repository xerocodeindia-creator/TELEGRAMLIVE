import { n8nConfig, readRows, type Row } from "@/lib/n8n";

// Ashish Team (Aarohi) team members: name, daily target, last login. n8n data table aarohi_team_members.
export const TEAM_TABLE = process.env.N8N_TEAM_MEMBERS_TABLE_ID || "q53thl9awsWn2Z9A";
export type Member = { name: string; target: number; lastLogin: string };

let cache: { at: number; list: Member[] } | null = null;

export async function listMembers(fresh = false): Promise<Member[]> {
  if (!fresh && cache && Date.now() - cache.at < 60000) return cache.list;
  const rows = await readRows(TEAM_TABLE, { max: 500 }).catch(() => [] as Row[]);
  const seen = new Map<string, Member>();
  for (const r of rows) {
    const name = String(r.name || "").trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const m = { name, target: Number(r.target) || 0, lastLogin: String(r.last_login || "") };
    const old = seen.get(k);
    if (!old || m.lastLogin > old.lastLogin) seen.set(k, { ...m, target: m.target || old?.target || 0 });
  }
  cache = { at: Date.now(), list: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  return cache.list;
}

async function upsertByName(name: string, data: Row) {
  const { baseUrl, apiKey } = n8nConfig();
  const res = await fetch(new URL(`/api/v1/data-tables/${encodeURIComponent(TEAM_TABLE)}/rows/upsert`, baseUrl), {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ filter: { type: "and", filters: [{ columnName: "name", condition: "eq", value: name }] }, data: { name, ...data }, returnData: false }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`n8n returned ${res.status}`);
  cache = null;
}

/** A team member logged in from the app: added automatically (new members need no setup). */
export async function touchMember(name: string) {
  const list = await listMembers();
  const known = list.find(m => m.name.toLowerCase() === name.toLowerCase());
  await upsertByName(known ? known.name : name, { last_login: new Date().toISOString() });
}

export async function setTarget(name: string, target: number) {
  const list = await listMembers();
  const known = list.find(m => m.name.toLowerCase() === name.toLowerCase());
  await upsertByName(known ? known.name : name, { target: Math.max(0, Math.min(1000, Math.round(target))) });
}

/** Ashish Team member access to one user (Aarohi only): not another member's user, and not a user already Done.
 *  Returns an error text, or "" when allowed. Master / website / Aisha: always allowed. */
export function memberBlock(row: Row | undefined, role: string, name: string, isAisha: boolean): string {
  if (isAisha || role !== "member" || !row) return "";
  const assigned = String(row.assigned_to || "").trim();
  if (assigned && assigned.toLowerCase() !== name.trim().toLowerCase()) return "Ye user kisi aur team member ko diya gaya hai";
  if (String(row.trade_status || "") === "done") return "Trade Done — ye chat band hai";
  return "";
}
