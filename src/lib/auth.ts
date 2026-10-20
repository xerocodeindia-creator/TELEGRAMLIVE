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
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export const privateJsonHeaders = { "Cache-Control": "no-store", "Vary": "Cookie" };
