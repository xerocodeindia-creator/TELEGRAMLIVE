import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, findByColumn, upsertByClientId, sendTelegram, sendTelegramPhoto, logAdminMessage, logAdminPhoto, pauseAfterHumanReply } from "@/lib/n8n";
import { IS_AISHA } from "@/lib/brand";
import { TRADE_TEMPLATES } from "@/lib/trade-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Aisha team app: "Payment bheja". Sends the payment screenshot, then the campaign's trade instructions,
// and moves the user to the Payment tab (trade_status = payment_sent). Nothing is marked if the photo fails.
export async function POST(req: Request) {
  if (!IS_AISHA) return jsonError("Not available", 404);
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);

  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const by = String(body.by || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const template = TRADE_TEMPLATES.find(t => t.key === String(body.template || ""));
  const imageBase64 = String(body.imageBase64 || "").replace(/^data:[^,]*,/, "");
  const mimeType = /^image\/(jpeg|png|webp)$/.test(String(body.mimeType || "")) ? String(body.mimeType) : "image/jpeg";
  if (!/^\d{1,24}$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (!template) return jsonError("Campaign chuno");
  if (!imageBase64 || !/^[A-Za-z0-9+/=]+$/.test(imageBase64) || imageBase64.length > 4_000_000) return jsonError("Payment screenshot attach karo");

  const cfg = n8nConfig();
  const row = await findByColumn(cfg.tables.clients, "client_id", chatId).catch(() => undefined);
  if (!row) return jsonError("User nahi mila", 404);

  let photo: any;
  try { photo = await sendTelegramPhoto(chatId, imageBase64, mimeType, ""); }
  catch (error) { return NextResponse.json({ error: "Screenshot nahi gaya", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders }); }
  try { await logAdminPhoto(chatId, "", String(photo?.file_id || ""), String(photo?.message_id || "")); } catch {}

  let textSent = false, textError = "";
  try {
    const r: any = await sendTelegram(chatId, template.message);
    textSent = true;
    try { await logAdminMessage(chatId, template.message, String(r?.result?.message_id || r?.message_id || "")); } catch {}
  } catch (error) { textError = error instanceof Error ? error.message : "send failed"; }

  const at = new Date().toISOString();
  let saved = false;
  try {
    await upsertByClientId(cfg.tables.clients, chatId, { trade_status: "payment_sent", trade_status_at: at, trade_status_by: by, trade_campaign: template.key });
    saved = true;
  } catch {}
  try { await pauseAfterHumanReply(chatId); } catch {}
  console.log(`[trade-payment] ${chatId} campaign=${template.key} by "${by}" photo=ok text=${textSent ? "ok" : "FAILED " + textError} saved=${saved}`);
  return NextResponse.json({ ok: true, status: "payment_sent", at, by, campaign: template.key, textSent, textError, saved }, { headers: privateJsonHeaders });
}
