import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, insertRows } from "@/lib/n8n";
import { TASK_IDS, type TaskId } from "@/lib/task-messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TASK_NAMES: Record<TaskId, string> = { task_1_angel_one: "ANGEL ONE", task_2_choice_finx: "CHOICE FINX", task_3: "BAJAJ" };
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

// Human (dashboard) submits a task proof: screenshot + details go to the admin Telegram chat and
// the proof is saved in task_submissions. Marking the task complete is a separate call
// (/api/task-action) that the dashboard fires right after, so the admin send returns fast.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  const taskId = String(body.taskId || "") as TaskId;
  const details = String(body.details || "").replace(/\r\n/g, "\n").trim();
  const imageBase64 = String(body.imageBase64 || "").replace(/^data:[^,]*,/, "");
  const mimeType = /^image\/(jpeg|png|webp)$/.test(String(body.mimeType || "")) ? String(body.mimeType) : "image/jpeg";
  const userName = clean(body.userName, 80);
  const userPhone = clean(body.userPhone, 20);
  const status = String(body.completeNote || "");
  if (!/^\d{1,24}$/.test(clientId)) return jsonError("Invalid Telegram user ID");
  if (!TASK_IDS.includes(taskId)) return jsonError("Unknown task");
  if (!details) return jsonError("Name / number details likho");
  if (details.length > 600) return jsonError("Details 600 characters se kam rakho");
  if (!imageBase64 || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) return jsonError("Screenshot attach karo");
  if (imageBase64.length > 4_000_000) return jsonError("Screenshot bahut bada hai");

  const cfg = n8nConfig();
  if (!cfg.configured || !cfg.proxySecret) return jsonError("n8n is not configured on the server.", 503);

  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  const caption = [
    `🧑‍💼 HUMAN SUBMIT — ${TASK_NAMES[taskId]} (Task ${TASK_IDS.indexOf(taskId) + 1})`,
    "",
    `User: ${userName || "-"}`,
    `Telegram ID: ${clientId}`,
    `Bot phone: ${userPhone || "-"}`,
    "",
    "📝 Details:",
    details,
    "",
    `Submitted: ${when} IST (dashboard)`,
    status === "complete" ? "✅ Task complete mark kiya" : status === "already" ? "ℹ️ Ye task pehle se complete tha" : "ℹ️ Sirf proof bheja (task complete mark nahi kiya)",
  ].join("\n").slice(0, 1024);

  // 1) Screenshot + details to the admin chat (through n8n, live bot credential).
  let adminMessageId = "";
  let fileId = "";
  try {
    const response = await fetch(`${cfg.baseUrl}/webhook/telegram-admin-proof-${cfg.proxySecret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ imageBase64, mimeType, caption }),
      cache: "no-store",
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.description || data.message || `n8n proxy HTTP ${response.status}`);
    adminMessageId = String(data.result?.message_id || "");
    fileId = String(data.result?.file_id || "");
  } catch (error) {
    return NextResponse.json({ error: "Admin ko screenshot nahi gaya", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }

  // 2) Save the proof (shows up with the other task proofs).
  let saved = false;
  const now = new Date().toISOString();
  try {
    await insertRows(cfg.tables.submissions, [{
      submission_id: `h${Date.now().toString(36)}_${clientId}`,
      client_id: clientId,
      first_name: userName,
      phone_number: userPhone,
      task_id: taskId,
      file_id: fileId,
      ai_analysis: `HUMAN SUBMIT (dashboard): ${details}`,
      status: "approved",
      submitted_at: now,
      admin_decision: "human_submitted",
      decided_by: "dashboard human",
      decided_at: now,
    }]);
    saved = true;
  } catch {}

  return NextResponse.json({ adminSent: true, adminMessageId, saved }, { headers: privateJsonHeaders });
}
