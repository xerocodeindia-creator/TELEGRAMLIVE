import crypto from "node:crypto";
// Short-lived signed link for the Excel report, so the phone's browser can download it without the app cookie.
const sign = (v: string) => crypto.createHmac("sha256", process.env.DASHBOARD_SESSION_SECRET || "").update("report:" + v).digest("base64url");
export function makeReportToken(range: string, from: string, to: string) {
  const p = Buffer.from(JSON.stringify({ range, from, to, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  return p + "." + sign(p);
}
export function readReportToken(t: string): { range: string; from: string; to: string } | null {
  const [p, s] = String(t || "").split(".");
  if (!p || !s || !process.env.DASHBOARD_SESSION_SECRET) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const j = JSON.parse(Buffer.from(p, "base64url").toString()); return j.exp > Date.now() ? j : null; } catch { return null; }
}
