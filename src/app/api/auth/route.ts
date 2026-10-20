import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const cookieName = "aarohi_admin_session";
function b64(s: string) { return Buffer.from(s).toString("base64url"); }
function signature(value: string, secret: string) { return crypto.createHmac("sha256", secret).update(value).digest("base64url"); }
function sessionValue(secret: string) {
  const payload = b64(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, n: crypto.randomBytes(18).toString("hex") }));
  return payload + "." + signature(payload, secret);
}
function validSession(token: string, secret: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature(payload, secret)))) return false;
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
  const jar = await cookies();
  const passwordConfigured = !!process.env.DASHBOARD_ADMIN_PASSWORD && !!process.env.DASHBOARD_SESSION_SECRET;
  const ok = passwordConfigured && await isAuthed();
  return NextResponse.json({ authenticated: ok, passwordConfigured }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!password || !secret) return NextResponse.json({ error: "Admin login is not configured yet. Set server-side environment variables." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const expected = Buffer.from(password);
  const given = Buffer.from(String(body.password || ""));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  const token = sessionValue(secret);
  const res = NextResponse.json({ authenticated: true });
  res.cookies.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return res;
}
export async function DELETE() {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
