import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";

async function getTableRows(baseUrl: string, apiKey: string, tableId: string) {
  const pageSize = 250;
  const maxRows = 20000;
  const rows: any[] = [];
  let cursor = "";
  const seenCursors = new Set<string>();

  for (let page = 0; page < Math.ceil(maxRows / pageSize); page++) {
    const url = new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows`, baseUrl);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("sortBy", "createdAt:desc");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      headers: { "X-N8N-API-KEY": apiKey, "Accept": "application/json" },
      cache: "no-store"
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`n8n Data Tables API returned ${response.status}: ${text.slice(0, 180)}`);

    const payload = JSON.parse(text);
    const batch = Array.isArray(payload) ? payload : payload.data || payload.rows || payload.items || [];
    if (!Array.isArray(batch)) throw new Error("Unexpected n8n Data Tables rows response.");
    rows.push(...batch);

    const nextCursor = typeof payload.nextCursor === "string" ? payload.nextCursor : "";
    if (!nextCursor || batch.length === 0 || seenCursors.has(nextCursor) || rows.length >= maxRows) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return rows;
}
export async function GET() {
  if (!await requireAdmin()) return jsonError("Unauthorized", 401);
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const clientsTable = process.env.N8N_CLIENT_PROGRESS_TABLE_ID || "yC8taftOgA9mXftw";
  const submissionsTable = process.env.N8N_TASK_SUBMISSIONS_TABLE_ID || "trjvYIR4ee5ZpWas";
  const messagesTable = process.env.N8N_CONVERSATION_MESSAGES_TABLE_ID || "PHT0vNxeMxik6br6";
  const controlsTable = process.env.N8N_USER_CONTROLS_TABLE_ID || "pS2jwzLkwHQ8or3w";
  if (!baseUrl || !apiKey) return NextResponse.json({ connected: false, reason: "n8n_not_configured", clients: [], submissions: [], messages: [], messagesConfigured: false }, { status: 200, headers: privateJsonHeaders });
  try {
    const [clients, submissions, messages, controls] = await Promise.all([
      getTableRows(baseUrl, apiKey, clientsTable),
      getTableRows(baseUrl, apiKey, submissionsTable),
      getTableRows(baseUrl, apiKey, messagesTable),
      getTableRows(baseUrl, apiKey, controlsTable)
    ]);
    const controlByClient = new Map<string, any>(
      controls.map((row: any): [string, any] => [String(row.client_id || ""), row])
    );
    const progressById = new Map<string, any>(
      clients.map((row: any) => [String(row.client_id || ""), row])
    );
    // Include conversations that started before their progress record was created.
    for (const message of messages) {
      const chatId = String(message?.chat_id || "");
      if (!/^\\d+$/.test(chatId) || progressById.has(chatId)) continue;
      progressById.set(chatId, {
        client_id: chatId,
        first_name: String(message.first_name || "Telegram user"),
        flow_step: "conversation_started",
        current_task: "",
        proof_status: "not_submitted",
        completed_tasks: "[]",
        phone_number: "",
        ai_paused: false,
        updatedAt: message.event_time || message.createdAt || new Date().toISOString()
      });
    }
    const clientsWithControls = Array.from(progressById.values()).map((row: any) => ({
      ...row,
      ai_paused: Boolean(controlByClient.get(String(row.client_id || ""))?.ai_paused) || Boolean(row.ai_paused)
    }));
    const sortedMessages = messages
      .filter((m: any) => m && m.chat_id != null)
      .sort((a: any, b: any) => new Date(String(a.event_time || a.createdAt || 0)).getTime() - new Date(String(b.event_time || b.createdAt || 0)).getTime())
      .slice(-1000);
    return NextResponse.json({ connected: true, clients: clientsWithControls, submissions, messages: sortedMessages, messagesConfigured: true }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ connected: false, reason: "n8n_api_error", error: error instanceof Error ? error.message : "Unknown n8n API error", clients: [], submissions: [], messages: [], messagesConfigured: false }, { status: 502, headers: privateJsonHeaders });
  }
}
