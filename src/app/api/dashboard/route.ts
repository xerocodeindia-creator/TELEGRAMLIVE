import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";

async function getTableRows(baseUrl: string, apiKey: string, tableId: string) {
  const url = new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows`, baseUrl);
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: { "X-N8N-API-KEY": apiKey, "Accept": "application/json" }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n Data Tables API returned ${response.status}: ${text.slice(0, 180)}`);
  const payload = JSON.parse(text);
  if (Array.isArray(payload)) return payload;
  return payload.data || payload.rows || payload.items || [];
}
export async function GET() {
  if (!await requireAdmin()) return jsonError("Unauthorized", 401);
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const clientsTable = process.env.N8N_CLIENT_PROGRESS_TABLE_ID || "yC8taftOgA9mXftw";
  const submissionsTable = process.env.N8N_TASK_SUBMISSIONS_TABLE_ID || "trjvYIR4ee5ZpWas";
  const messagesTable = process.env.N8N_CONVERSATION_MESSAGES_TABLE_ID || "PHT0vNxeMxik6br6";
  if (!baseUrl || !apiKey) return NextResponse.json({ connected: false, reason: "n8n_not_configured", clients: [], submissions: [], messages: [], messagesConfigured: false }, { status: 200, headers: privateJsonHeaders });
  try {
    const [clients, submissions, messages] = await Promise.all([
      getTableRows(baseUrl, apiKey, clientsTable),
      getTableRows(baseUrl, apiKey, submissionsTable),
      getTableRows(baseUrl, apiKey, messagesTable)
    ]);
    const sortedMessages = messages
      .filter((m: any) => m && m.chat_id != null)
      .sort((a: any, b: any) => new Date(String(a.event_time || a.createdAt || 0)).getTime() - new Date(String(b.event_time || b.createdAt || 0)).getTime())
      .slice(-1000);
    return NextResponse.json({ connected: true, clients, submissions, messages: sortedMessages, messagesConfigured: true }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ connected: false, reason: "n8n_api_error", error: error instanceof Error ? error.message : "Unknown n8n API error", clients: [], submissions: [], messages: [], messagesConfigured: false }, { status: 502, headers: privateJsonHeaders });
  }
}
