// Small helper around the n8n public Data Tables API and the Telegram proxy webhooks.
// All dashboard routes go through here so table IDs, auth and error handling live in one place.

export type Row = Record<string, any>;

export function n8nConfig() {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/+$/, "") || "";
  const apiKey = process.env.N8N_API_KEY || "";
  return {
    baseUrl,
    apiKey,
    configured: Boolean(baseUrl && apiKey),
    proxySecret: process.env.N8N_TELEGRAM_IMAGE_PROXY_SECRET || "",
    tables: {
      clients: process.env.N8N_CLIENT_PROGRESS_TABLE_ID || "yC8taftOgA9mXftw",
      submissions: process.env.N8N_TASK_SUBMISSIONS_TABLE_ID || "trjvYIR4ee5ZpWas",
      messages: process.env.N8N_CONVERSATION_MESSAGES_TABLE_ID || "PHT0vNxeMxik6br6",
      controls: process.env.N8N_USER_CONTROLS_TABLE_ID || "pS2jwzLkwHQ8or3w",
    },
  };
}

type ListOptions = { limit?: number; sortBy?: string; cursor?: string; filter?: object };

export async function listRows(tableId: string, opts: ListOptions = {}) {
  const { baseUrl, apiKey } = n8nConfig();
  const url = new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows`, baseUrl);
  url.searchParams.set("limit", String(opts.limit ?? 250));
  if (opts.sortBy) url.searchParams.set("sortBy", opts.sortBy);
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);
  if (opts.filter) url.searchParams.set("filter", JSON.stringify(opts.filter));
  const response = await fetch(url, { headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n Data Tables API returned ${response.status}: ${text.slice(0, 180)}`);
  const payload = JSON.parse(text);
  const rows: Row[] = Array.isArray(payload) ? payload : payload.data || payload.rows || payload.items || [];
  if (!Array.isArray(rows)) throw new Error("Unexpected n8n Data Tables rows response.");
  const nextCursor = typeof payload.nextCursor === "string" ? payload.nextCursor : "";
  return { rows, nextCursor };
}

/** Reads pages (newest first by default) until `stop(row)` is true for a row, or `max` rows are read. */
export async function readRows(tableId: string, opts: { sortBy?: string; max?: number; pageSize?: number; filter?: object; stop?: (row: Row) => boolean } = {}) {
  const pageSize = opts.pageSize ?? 250;
  const max = opts.max ?? 20000;
  const out: Row[] = [];
  const seen = new Set<string>();
  let cursor = "";
  while (out.length < max) {
    const { rows, nextCursor } = await listRows(tableId, { limit: pageSize, sortBy: opts.sortBy ?? "createdAt:desc", cursor, filter: opts.filter });
    let stopped = false;
    for (const row of rows) {
      if (opts.stop && opts.stop(row)) { stopped = true; break; }
      out.push(row);
    }
    if (stopped || !nextCursor || rows.length === 0 || seen.has(nextCursor)) break;
    seen.add(nextCursor);
    cursor = nextCursor;
  }
  return out;
}

/** Finds the first row where column == value: uses the API filter (one small request), falls back to a scan. */
export async function findByColumn(tableId: string, column: string, value: string): Promise<Row | undefined> {
  const match = (r: Row) => String(r[column] ?? "") === value;
  try {
    const { rows } = await listRows(tableId, { limit: 5, filter: { type: "and", filters: [{ columnName: column, condition: "eq", value }] } });
    const hit = rows.find(match);
    if (hit || rows.length === 0) return hit;
  } catch {}
  return (await readRows(tableId, { max: 20000 })).find(match);
}

export async function insertRows(tableId: string, rows: Row[]) {
  const { baseUrl, apiKey } = n8nConfig();
  const response = await fetch(new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows`, baseUrl), {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ data: rows }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n returned ${response.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return {}; }
}

export async function upsertByClientId(tableId: string, clientId: string, data: Row) {
  const { baseUrl, apiKey } = n8nConfig();
  const response = await fetch(new URL(`/api/v1/data-tables/${encodeURIComponent(tableId)}/rows/upsert`, baseUrl), {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      filter: { type: "and", filters: [{ columnName: "client_id", condition: "eq", value: clientId }] },
      data: { client_id: clientId, ...data },
      returnData: true,
    }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n returned ${response.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return {}; }
}

/** Sends a plain-text Telegram message through the n8n proxy (uses the live bot credential). */
export async function sendTelegram(chatId: string, text: string) {
  const { baseUrl, proxySecret } = n8nConfig();
  if (!baseUrl || !proxySecret) throw new Error("Telegram manual reply proxy is not configured on the server.");
  const response = await fetch(`${baseUrl}/webhook/telegram-manual-reply-${proxySecret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ chatId, text }),
    cache: "no-store",
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || data.message || `Telegram send failed (n8n proxy HTTP ${response.status})`);
  }
  return data.result || {};
}

/** Saves an admin-sent message to conversation_messages so it shows in the dashboard history. */
export async function logAdminMessage(chatId: string, text: string, telegramMessageId: string, sendStatus = "manual_admin", taskId = "") {
  const { tables } = n8nConfig();
  return insertRows(tables.messages, [{
    event_key: `admin_${chatId}_${telegramMessageId || Date.now()}`,
    chat_id: chatId,
    user_id: chatId,
    first_name: "Admin",
    direction: "outbound",
    message_type: "text",
    text,
    caption: "",
    file_id: "",
    telegram_message_id: telegramMessageId,
    event_time: new Date().toISOString(),
    send_status: sendStatus,
    task_id: taskId,
    ai_analysis: "",
  }]);
}

export const GLOBAL_CONTROL_ID = "global";

/**
 * After an admin replies to a user from the dashboard, hand that user over to humans:
 * the workflow then sends them nothing automatic (after Task 1) until someone presses "Resume AI".
 * An existing pause (e.g. NO_KYC block or a manual pause) is left untouched.
 */
export async function pauseAfterHumanReply(clientId: string) {
  const { tables } = n8nConfig();
  const row = await findByColumn(tables.controls, "client_id", clientId);
  const already = row && (row.ai_paused === true || String(row.ai_paused) === "true");
  if (already) return { paused: true, changed: false };
  await upsertByClientId(tables.controls, clientId, {
    ai_paused: true,
    paused_by: "dashboard_reply",
    paused_at: new Date().toISOString(),
    reason: "HUMAN_REPLY: admin replied from dashboard",
  });
  return { paused: true, changed: true };
}
