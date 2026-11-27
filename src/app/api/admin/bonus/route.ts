import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSession, jsonError, privateJsonHeaders } from "@/lib/auth";
import { IS_AISHA } from "@/lib/brand";
import { n8nConfig, sendTelegram } from "@/lib/n8n";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ashish Team master admin (28 Nov 2026): Bonus Ready campaign from the app.
// Uses the existing n8n "Bonus Campaign Webhook" (same rules as the chat-run campaign: already-sent users are skipped).
//  { numbers: "pasted text", mode: "step1"|"followup", step: "dry"|"test"|"send" }
// dry  → who will get it / not found / skipped (nothing sent)
// test → the message only to the admin's own Telegram
// send → real send runs in the background; the summary comes on the admin's Telegram.
const ADMIN_CHAT = "905651310";

function parseNumbers(text: string) {
  const out: string[] = [];
  for (const m of String(text || "").match(/\+?\d[\d\s-]{8,16}\d/g) || []) {
    const d = m.replace(/\D/g, "");
    const p = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
    if (/^[6-9]\d{9}$/.test(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

async function callCampaign(body: object) {
  const { baseUrl } = n8nConfig();
  const path = process.env.AAROHI_BONUS_WEBHOOK_PATH || "";
  if (!baseUrl || !path) throw new Error("Bonus webhook server pe set nahi hai");
  const r = await fetch(`${baseUrl}/webhook/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const t = await r.text();
  let j: any = {};
  try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  if (!r.ok) throw new Error(j?.message || `n8n ${r.status}`);
  return Array.isArray(j) ? j[0] || {} : j;
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "master" || IS_AISHA) return jsonError("Sirf admin", 403);
  const b = await req.json().catch(() => ({}));
  const phones = parseNumbers(String(b.numbers || ""));
  const mode = b.mode === "followup" ? "followup" : "step1";
  const step = ["dry", "test", "send"].includes(b.step) ? b.step : "dry";
  if (step !== "test" && !phones.length) return jsonError("Koi sahi 10-digit number nahi mila");
  if (phones.length > 1000) return jsonError("Ek baar mein 1000 tak numbers");
  const t0 = Date.now();
  try {
    if (step === "dry") {
      const j = await callCampaign({ phones, mode, dryRun: true });
      console.log(`[admin-bonus] dry ${mode} in=${phones.length} send=${j.will_send} ${Date.now() - t0} ms`);
      return NextResponse.json({
        parsed: phones.length, willSend: j.will_send ?? 0, notFound: j.not_found || [], skipped: (j.skipped || []).map((x: any) => ({ name: x.first_name, last4: x.phone_last4, why: x.why })),
        list: (j.list || []).map((x: any) => ({ name: x.first_name, last4: x.phone_last4 })),
      }, { headers: privateJsonHeaders });
    }
    if (step === "test") {
      const j = await callCampaign({ phones: [], chatIds: [ADMIN_CHAT], mode, dryRun: false, testAdmin: true });
      return NextResponse.json({ ok: (j.sent_count ?? 0) > 0, sent: j.sent_count ?? 0 }, { headers: privateJsonHeaders });
    }
    // Real send: keep going after the app gets its answer; report on the admin's Telegram.
    const by = s.name || "Admin";
    waitUntil((async () => {
      let msg: string;
      try {
        const j = await callCampaign({ phones, mode, dryRun: false });
        msg = `✅ Bonus campaign (${mode === "followup" ? "follow-up" : "Bonus Ready"}) app se — ${by}\nNumbers: ${phones.length}\nBheje: ${j.sent_count ?? 0}\nFail: ${j.failed_count ?? 0}${(j.failed || []).length ? "\nFail IDs: " + (j.failed as any[]).slice(0, 15).map(f => f.client_id).join(", ") : ""}\nTime: ${Math.round((Date.now() - t0) / 1000)} sec`;
        console.log(`[admin-bonus] send ${mode} in=${phones.length} sent=${j.sent_count} failed=${j.failed_count} ${Date.now() - t0} ms`);
      } catch (e) {
        msg = `⚠️ Bonus campaign app se nahi chala (${by}): ${e instanceof Error ? e.message : "error"}`;
        console.log(`[admin-bonus] send error ${msg}`);
      }
      await sendTelegram(ADMIN_CHAT, msg).catch(() => undefined);
    })());
    return NextResponse.json({ started: true, numbers: phones.length }, { headers: privateJsonHeaders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 502, headers: privateJsonHeaders });
  }
}
