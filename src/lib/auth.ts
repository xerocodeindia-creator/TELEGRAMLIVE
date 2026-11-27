import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE = "aarohi_admin_session";
const b64 = (s: string) => Buffer.from(s).toString("base64url");
function sign(value: string, secret: string) { return crypto.createHmac("sha256", secret).update(value).digest("base64url"); }
export async function requireAdmin() {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;
  const token = (await cookies()).get(COOKIE)?.value || "";
  if (!secret || !password || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot), sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload,"base64url").toString()).exp > Date.now(); } catch { return false; }
}
/** Who is logged in (27 Nov 2026). role: "master" (Ashish Team admin password), "member" (team app login with a name),
 *  "web" (website dashboard / old app sessions without a name). Only Aarohi uses master/member. */
export type Session = { role: "master" | "member" | "web"; name: string };
export async function getSession(): Promise<Session | null> {
  if (!(await requireAdmin())) return null;
  const token = (await cookies()).get(COOKIE)?.value || "";
  try {
    const p = JSON.parse(Buffer.from(token.slice(0, token.indexOf(".")), "base64url").toString());
    const role = p.role === "master" ? "master" : p.role === "member" && String(p.name || "").trim() ? "member" : "web";
    return { role, name: String(p.name || "").trim().slice(0, 40) };
  } catch { return { role: "web", name: "" }; }
}
export async function requireMaster() { const s = await getSession(); return !!s && s.role === "master"; }
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export const privateJsonHeaders = { "Cache-Control": "no-store", "Vary": "Cookie" };
