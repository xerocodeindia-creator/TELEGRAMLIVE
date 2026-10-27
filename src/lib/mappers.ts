import type { Row } from "./n8n";

export function toMillis(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const d = Date.parse(String(value));
  return Number.isFinite(d) ? d : 0;
}

export function mapMessage(m: Row) {
  const status = String(m.send_status || "");
  const dir = String(m.direction || "");
  const direction = dir === "inbound" ? "in" : status.startsWith("manual_admin") ? "admin" : "bot";
  const stamp = toMillis(m.event_time) || toMillis(m.createdAt);
  return {
    id: Number(m.id) || 0,
    chatId: String(m.chat_id ?? m.user_id ?? "").trim(),
    name: String(m.first_name || ""),
    direction,
    type: String(m.message_type || (m.file_id ? "photo" : "text")),
    text: String(m.text || m.caption || ""),
    fileId: m.file_id ? String(m.file_id) : "",
    time: stamp ? new Date(stamp).toISOString() : "",
    status,
    tgId: Number(m.telegram_message_id) || 0,
  };
}

