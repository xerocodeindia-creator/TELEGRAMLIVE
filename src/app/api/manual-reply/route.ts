import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { sendTelegram, logAdminMessage } from "@/lib/n8n";

export async function POST(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);
  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const text = String(body.text || "").replace(/\r\n/g, "\n").trim();
  if (!/^-?\d+$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (!text || text.length > 4000) return jsonError("Message must be between 1 and 4000 characters");

  // Sent through n8n so the live bot credential is used (no second bot token in Vercel).
  let result: any;
  try {
    result = await sendTelegram(chatId, text);
  } catch (error) {
    return NextResponse.json({ error: "Telegram send failed", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }

  const telegramMessageId = String(result?.message_id || "");
  let logged = false;
  let logError = "";
  try {
    await logAdminMessage(chatId, text, telegramMessageId);
    logged = true;
  } catch (error) {
    logError = error instanceof Error ? error.message : "Unknown cloud logging error";
  }
  return NextResponse.json({ sent: true, logged, logError, messageId: telegramMessageId }, { headers: privateJsonHeaders });
}
