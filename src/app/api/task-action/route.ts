import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, readRows, upsertByClientId, sendTelegram, logAdminMessage } from "@/lib/n8n";
import { TASK_COMPLETION, TASK_IDS, type TaskId } from "@/lib/task-messages";

export const dynamic = "force-dynamic";

// Admin marks a client's task complete from the dashboard (needed in Human mode, when the
// workflow no longer auto-verifies screenshots). Same state change + messages as the workflow.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  const taskId = String(body.taskId || "") as TaskId;
  const sendMessages = body.sendMessages !== false;
  if (!/^\d{1,24}$/.test(clientId)) return jsonError("Invalid Telegram user ID");
  if (!TASK_IDS.includes(taskId)) return jsonError("Unknown task");

  const cfg = n8nConfig();
  if (!cfg.configured) return jsonError("n8n API is not configured on the server.", 503);

  // client_progress is small, so read it and pick the row (works on every n8n version).
  let row: Record<string, any> | undefined;
  try {
    const rows = await readRows(cfg.tables.clients, {});
    row = rows.find(r => String(r.client_id || "") === clientId);
  } catch (error) {
    return NextResponse.json({ error: "Could not read client progress.", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }

  let completed: string[] = [];
  try { const v = JSON.parse(String(row?.completed_tasks || "[]")); if (Array.isArray(v)) completed = v.map(String); } catch {}
  const index = TASK_IDS.indexOf(taskId);
  // Completing a later task also records the earlier ones, so the order stays consistent.
  for (const id of TASK_IDS.slice(0, index + 1)) if (!completed.includes(id)) completed.push(id);

  const plan = TASK_COMPLETION[taskId];
  const now = new Date().toISOString();
  try {
    await upsertByClientId(cfg.tables.clients, clientId, {
      completed_tasks: JSON.stringify(completed),
      current_task: plan.next.current_task,
      flow_step: plan.next.flow_step,
      next_task_allowed: plan.next.next_task_allowed,
      proof_status: "approved",
      last_submission_id: `dashboard_${Date.now().toString(36)}`,
      [plan.stampColumn]: now,
    });
  } catch (error) {
    return NextResponse.json({ error: "Could not update client progress.", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }

  const sent: string[] = [];
  const failed: string[] = [];
  if (sendMessages) {
    for (const text of plan.messages) {
      try {
        const result = await sendTelegram(clientId, text);
        sent.push(text);
        await logAdminMessage(clientId, text, String(result?.message_id || ""), "manual_admin_task", taskId).catch(() => undefined);
      } catch (error) {
        failed.push(error instanceof Error ? error.message : "send failed");
        break;
      }
    }
  }

  return NextResponse.json({ updated: true, clientId, taskId, completed, next: plan.next, sentCount: sent.length, failed }, { headers: privateJsonHeaders });
}
