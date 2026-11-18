import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { sendTelegramPhoto, logAdminPhoto, pauseAfterHumanReply } from "@/lib/n8n";
import { IS_AISHA } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Aisha only: admin sends a photo (+ optional caption) to one user from the chat.
// Same rules as a text reply: logged in the history and the user is handed over to humans.
export async function POST(req: Request) {
  if (!IS_AISHA) return jsonError("Not available", 404);
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);

  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const caption = String(body.caption || "").replace(/\r\n/g, "\n").trim();
  const imageBase64 = String(body.imageBase64 || "").replace(/^data:[^,]*,/, "");
  const mimeType = /^image\/(jpeg|png|webp)$/.test(String(body.mimeType || "")) ? String(body.mimeType) : "image/jpeg";
  if (!/^\d{1,24}$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (caption.length > 1000) return jsonError("Caption 1000 characters se kam rakho");
  if (!imageBase64 || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) return jsonError("Image attach karo");
  if (imageBase64.length > 4_000_000) return jsonError("Image bahut badi hai");

  let result: any;
  try {
    result = await sendTelegramPhoto(chatId, imageBase64, mimeType, caption);
  } catch (error) {
    return NextResponse.json({ error: "Photo nahi gayi", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }
  const messageId = String(result?.message_id || "");
  const fileId = String(result?.file_id || "");

  let logged = false;
  try { await logAdminPhoto(chatId, caption, fileId, messageId); logged = true; } catch {}
  let aiPausedNow = false;
  try { aiPausedNow = (await pauseAfterHumanReply(chatId)).changed; } catch {}
  return NextResponse.json({ sent: true, logged, messageId, fileId, aiPausedNow }, { headers: privateJsonHeaders });
}
