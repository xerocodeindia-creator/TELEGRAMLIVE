import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";

export async function POST(req: Request) {
  if (!await requireAdmin()) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "Telegram manual messaging is not configured on the server." }, { status: 503, headers: privateJsonHeaders });
  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const text = String(body.text || "").trim();
  if (!/^-?\d+$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (!text || text.length > 4000) return jsonError("Message must be between 1 and 4000 characters");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) return NextResponse.json({ error: "Telegram send failed", detail: data.description || "Unknown Telegram API error" }, { status: 502, headers: privateJsonHeaders });
  return NextResponse.json({ sent: true, messageId: data.result?.message_id, chatId: data.result?.chat?.id }, { headers: privateJsonHeaders });
}
