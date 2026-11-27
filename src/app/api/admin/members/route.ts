import { NextResponse } from "next/server";
import { getSession, jsonError, privateJsonHeaders } from "@/lib/auth";
import { IS_AISHA } from "@/lib/brand";
import { listMembers, setTarget } from "@/lib/team";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "master" || IS_AISHA) return jsonError("Sirf admin", 403);
  return NextResponse.json({ members: await listMembers(true) }, { headers: privateJsonHeaders });
}

// { name, target } — daily trade-done target for a team member.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "master" || IS_AISHA) return jsonError("Sirf admin", 403);
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) return jsonError("Naam chahiye");
  await setTarget(name, Number(b.target) || 0);
  return NextResponse.json({ ok: true }, { headers: privateJsonHeaders });
}
