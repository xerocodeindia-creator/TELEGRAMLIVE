import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { waitUntil } from "@vercel/functions";
import { sendTelegram, logAdminMessage, pauseAfterHumanReply } from "@/lib/n8n";

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
  const t0 = Date.now();
  let result: any;
  try {
    result = await sendTelegram(chatId, text);
  } catch (error) {
    return NextResponse.json({ error: "Telegram send failed", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }

  const telegramMessageId = String(result?.message_id || "");
  const sentMs = Date.now() - t0;
  // 27 Nov 2026: answer as soon as Telegram accepted the message; saving to history and pausing the AI
  // happen after the response (they took several seconds and made the app wait 10-15 s).
  waitUntil((async () => {
    const t1 = Date.now();
    await Promise.all([
      logAdminMessage(chatId, text, telegramMessageId).catch(e => console.log(`[manual-reply] log failed ${chatId}: ${e instanceof Error ? e.message : e}`)),
      pauseAfterHumanReply(chatId).catch(() => undefined),
    ]);
    console.log(`[manual-reply] ${chatId} send=${sentMs} ms after=${Date.now() - t1} ms`);
  })());
  return NextResponse.json({ sent: true, logged: true, logError: "", messageId: telegramMessageId, aiPaused: true, aiPausedNow: false }, { headers: privateJsonHeaders });
}
