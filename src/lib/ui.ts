// Shared client-side types and formatting helpers for the dashboard.

export type Msg = {
  id: number;
  chatId: string;
  name: string;
  direction: "in" | "bot" | "admin";
  type: string;
  text: string;
  fileId: string;
  time: string;
  status: string;
  local?: "sending" | "failed";
  tempKey?: string;
};

export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  flowStep: string;
  currentTask: string;
  proofStatus: string;
  completed: string[];
  updatedAt: string;
  t1: string;
  t2: string;
  t3: string;
};

export type Controls = { global: { paused: boolean; at: string }; users: Record<string, { paused: boolean; noKyc: boolean }> };

export type Chat = {
  id: string;
  name: string;
  phone: string;
  client?: ClientRow;
  paused: boolean;
  noKyc: boolean;
  last?: Msg;
  lastTime: number;
  unread: number;
  stage: Stage;
  /** Task 1 link already sent (has a task stage, or a Task 1/2/3 link message is in the log). */
  qualified: boolean;
  /** IST days (YYYY-MM-DD) on which this chat had any message or progress update. */
  days: Set<string>;
};

export type Stage = { key: "onboarding" | "t1" | "t2" | "t3" | "done"; short: string; label: string; index: number };

export const TASKS = [
  { id: "task_1_angel_one", name: "Angel One", short: "T1" },
  { id: "task_2_choice_finx", name: "Choice FinX", short: "T2" },
  { id: "task_3", name: "Bajaj", short: "T3" },
] as const;

export function stageOf(c?: ClientRow): Stage {
  if (!c) return { key: "onboarding", short: "New", label: "Onboarding", index: -1 };
  const done = c.completed || [];
  if (c.currentTask === "completed" || c.flowStep === "all_tasks_completed" || done.includes("task_3")) return { key: "done", short: "Done", label: "All tasks done", index: 3 };
  if (c.currentTask === "task_3" || /^task_3/.test(c.flowStep)) return { key: "t3", short: "T3", label: "Task 3 · Bajaj", index: 2 };
  if (c.currentTask === "task_2_choice_finx" || /^task_2/.test(c.flowStep)) return { key: "t2", short: "T2", label: "Task 2 · Choice FinX", index: 1 };
  if (c.currentTask === "task_1_angel_one" || /^task_1/.test(c.flowStep)) return { key: "t1", short: "T1", label: "Task 1 · Angel One", index: 0 };
  return { key: "onboarding", short: "New", label: "Onboarding", index: -1 };
}

const TZ = "Asia/Kolkata";
export const ms = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };
export function timeOf(iso: string) {
  const t = ms(iso);
  return t ? new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }) : "";
}
export function dayKey(t: number) { return new Date(t).toLocaleDateString("en-CA", { timeZone: TZ }); }
export function dayLabel(t: number) {
  const k = dayKey(t);
  const now = Date.now();
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now - 86400000)) return "Yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}
export function listTime(t: number) {
  if (!t) return "";
  const k = dayKey(t);
  if (k === dayKey(Date.now())) return new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
  if (k === dayKey(Date.now() - 86400000)) return "Yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", timeZone: TZ });
}
export function fullDate(iso: string) {
  const t = ms(iso);
  return t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }) : "";
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}
const AVATAR_COLORS = ["#e17076", "#7bc862", "#e5a64e", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];
export function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function isMedia(m: Msg) { return Boolean(m.fileId) || m.type === "photo" || m.type === "document"; }
export function preview(m?: Msg) {
  if (!m) return "No messages yet";
  const who = m.direction === "admin" ? "You: " : m.direction === "bot" ? "Bot: " : "";
  if (isMedia(m) && !m.text) return who + "📷 Photo";
  if (!m.text && m.type !== "text") return who + `🎙️ ${m.type}`;
  return who + (isMedia(m) ? "📷 " : "") + m.text.replace(/\s+/g, " ");
}

export function readStore(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem("aarohi_read_v2") || "{}"); } catch { return {}; }
}
export function writeStore(v: Record<string, number>) {
  try { localStorage.setItem("aarohi_read_v2", JSON.stringify(v)); } catch {}
}
