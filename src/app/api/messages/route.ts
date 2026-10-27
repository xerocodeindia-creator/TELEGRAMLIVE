import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows } from "@/lib/n8n";
import { msgCmp } from "@/lib/ui";
import { mapMessage } from "@/lib/mappers";

export const dynamic = "force-dynamic";

// Full history for one chat (the main dashboard feed only carries the most recent messages).
export async function GET(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const chatId = String(new URL(req.url).searchParams.get("chatId") || "").trim();
  if (!/^\d{1,24}$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  const cfg = n8nConfig();
  if (!cfg.configured) return jsonError("n8n API is not configured on the server.", 503);
  try {
    let rows;
    try {
      rows = await readRows(cfg.tables.messages, {
        max: 3000,
        filter: { type: "and", filters: [{ columnName: "chat_id", condition: "eq", value: chatId }] },
      });
    } catch {
      // Older n8n versions may not accept a filter on this endpoint: scan instead.
      rows = (await readRows(cfg.tables.messages, { max: 20000 })).filter(r => String(r.chat_id ?? r.user_id ?? "").trim() === chatId);
    }
    const messages = rows.map(mapMessage).filter(m => m.chatId === chatId).sort(msgCmp);
    return NextResponse.json({ chatId, messages }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load chat history." }, { status: 502, headers: privateJsonHeaders });
  }
}
