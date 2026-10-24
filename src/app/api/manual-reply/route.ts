import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";

export async function POST(req: Request) {
  if (!await requireAdmin()) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);
  const body = await req.json().catch(() => ({}));
  const chatId = String(body.chatId || "").trim();
  const text = String(body.text || "").trim();
  if (!/^-?\\d+$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  if (!text || text.length > 4000) return jsonError("Message must be between 1 and 4000 characters");

  // Use the live n8n Telegram credential so manual replies cannot drift from the bot
  // token configured on the active Telegram Trigger and image proxy.
  const n8nBaseUrl = process.env.N8N_BASE_URL?.replace(/\\/+$/, "");
  const proxySecret = process.env.N8N_TELEGRAM_IMAGE_PROXY_SECRET;
  if (!n8nBaseUrl || !proxySecret) {
    return NextResponse.json({ error: "Telegram manual reply proxy is not configured on the server." }, { status: 503, headers: privateJsonHeaders });
  }
  let data: any;
  try {
    const proxyResponse = await fetch(`${n8nBaseUrl}/webhook/telegram-manual-reply-${proxySecret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ chatId, text }),
      cache: "no-store"
    });
    data = await proxyResponse.json().catch(() => ({}));
    if (!proxyResponse.ok || !data.ok) {
      return NextResponse.json(
        { error: "Telegram send failed", detail: data.description || data.message || `n8n proxy returned HTTP ${proxyResponse.status}` },
        { status: 502, headers: privateJsonHeaders }
      );
    }
    data = { ok: true, result: data.result || {} };
  } catch {
    return NextResponse.json({ error: "Unable to reach the Telegram reply service." }, { status: 502, headers: privateJsonHeaders });
  }

  // Persist the successfully sent admin reply to the shared n8n Data Table.
  let logged = false;
  let logError = "";
  const n8nBaseUrl = process.env.N8N_BASE_URL;
  const n8nApiKey = process.env.N8N_API_KEY;
  const messagesTable = process.env.N8N_CONVERSATION_MESSAGES_TABLE_ID || "PHT0vNxeMxik6br6";
  if (n8nBaseUrl && n8nApiKey) {
    try {
      const logResponse = await fetch(new URL(`/api/v1/data-tables/${encodeURIComponent(messagesTable)}/rows`, n8nBaseUrl), {
        method: "POST",
        headers: { "X-N8N-API-KEY": n8nApiKey, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ data: [{
          event_key: `admin_${chatId}_${String(data.result?.message_id || Date.now())}`,
          chat_id: chatId,
          user_id: chatId,
          first_name: "Admin",
          direction: "outbound",
          message_type: "text",
          text,
          caption: "",
          file_id: "",
          telegram_message_id: String(data.result?.message_id || ""),
          event_time: new Date().toISOString(),
          send_status: "manual_admin",
          task_id: "",
          ai_analysis: ""
        }] }),
        cache: "no-store"
      });
      const logBody = await logResponse.text();
      if (!logResponse.ok) throw new Error(`n8n returned ${logResponse.status}: ${logBody.slice(0, 200)}`);
      logged = true;
    } catch (error) {
      logError = error instanceof Error ? error.message : "Unknown cloud logging error";
    }
  } else {
    logError = "N8N_BASE_URL or N8N_API_KEY is not configured.";
  }
  return NextResponse.json({ sent: true, logged, logError, messageId: data.result?.message_id, chatId: data.result?.chat?.id }, { headers: privateJsonHeaders });
}
