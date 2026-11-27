import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { IS_AISHA } from "@/lib/brand";
import { touchMember } from "@/lib/team";

const cookieName = "aarohi_admin_session";
function b64(s: string) { return Buffer.from(s).toString("base64url"); }
function signature(value: string, secret: string) { return crypto.createHmac("sha256", secret).update(value).digest("base64url"); }
function sessionValue(secret: string, role = "web", name = "") {
  const payload = b64(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, n: crypto.randomBytes(18).toString("hex"), role, name }));
  return payload + "." + signature(payload, secret);
}
function validSession(token: string, secret: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(signature(payload, secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
async function isAuthed() {
  const jar = await cookies();
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  const token = jar.get(cookieName)?.value || "";
  return !!password && !!secret && validSession(token, secret);
}
export async function GET() {
  const passwordConfigured = !!process.env.DASHBOARD_ADMIN_PASSWORD && !!process.env.DASHBOARD_SESSION_SECRET;
  const ok = passwordConfigured && await isAuthed();
  return NextResponse.json({ authenticated: ok, passwordConfigured }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!password || !secret) return NextResponse.json({ error: "Admin login is not configured yet. Set server-side environment variables." }, { status: 503 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const given = String(body.password || "");
  const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
  // Ashish Team master admin (27 Nov 2026): separate password, Aarohi only (env AAROHI_MASTER_PASSWORD).
  const master = !IS_AISHA ? process.env.AAROHI_MASTER_PASSWORD || "" : "";
  let role = "";
  if (master && same(master, given)) role = "master";
  else if (same(password, given)) role = name && body.app === true ? "member" : "web";
  if (!role) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  const token = sessionValue(secret, role, role === "master" ? name || "Admin" : name);
  if (role === "member" && !IS_AISHA) waitUntil(touchMember(name).catch(() => undefined));
  const res = NextResponse.json({ authenticated: true, role, name: role === "master" ? name || "Admin" : name });
  res.cookies.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return res;
}
export async function DELETE(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
