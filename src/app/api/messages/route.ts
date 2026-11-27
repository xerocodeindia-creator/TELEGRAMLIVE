import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders, getSession } from "@/lib/auth";
import { n8nConfig, readRows, findByColumn } from "@/lib/n8n";
import { memberBlock } from "@/lib/team";
import { IS_AISHA } from "@/lib/brand";
import { msgCmp } from "@/lib/ui";
import { mapMessage } from "@/lib/mappers";

export const dynamic = "force-dynamic";

// Full history for one chat (the main dashboard feed only carries the most recent messages).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  const chatId = String(new URL(req.url).searchParams.get("chatId") || "").trim();
  if (!/^\d{1,24}$/.test(chatId)) return jsonError("Invalid Telegram chat ID");
  const cfg = n8nConfig();
  if (!cfg.configured) return jsonError("n8n API is not configured on the server.", 503);
  const t0 = Date.now();
  const lim = Math.min(3000, Math.max(20, Number(new URL(req.url).searchParams.get("limit")) || 150));
  // Ashish Team member: the user's row is read alongside the history (no extra wait) to apply the Done lock.
  const isMember = !IS_AISHA && session.role === "member";
  const rowP = isMember ? findByColumn(cfg.tables.clients, "client_id", chatId).catch(() => undefined) : Promise.resolve(undefined);
  try {
    let rows;
    try {
      // 27 Nov 2026: newest 150 messages only (one request) instead of the whole history.
      rows = await readRows(cfg.tables.messages, {
        max: lim,
        pageSize: Math.min(lim, 250),
        filter: { type: "and", filters: [{ columnName: "chat_id", condition: "eq", value: chatId }] },
      });
    } catch {
      // Older n8n versions may not accept a filter on this endpoint: scan instead.
      rows = (await readRows(cfg.tables.messages, { max: 20000 })).filter(r => String(r.chat_id ?? r.user_id ?? "").trim() === chatId);
    }
    const block = memberBlock(await rowP, session.role, session.name, IS_AISHA);
    if (block) return NextResponse.json({ error: block, locked: true }, { status: 403, headers: privateJsonHeaders });
    const messages = rows.map(mapMessage).filter(m => m.chatId === chatId).sort(msgCmp);
    console.log(`[messages] ${chatId} ${Date.now() - t0} ms rows=${messages.length}`);
    return NextResponse.json({ chatId, messages }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load chat history." }, { status: 502, headers: privateJsonHeaders });
  }
}
