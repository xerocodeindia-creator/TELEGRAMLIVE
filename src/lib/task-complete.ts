// Marks a client's task complete (same state change + messages as the n8n workflow).
// Used by the "Task complete" button and by the "Task submit" (screenshot proof) form.
import { n8nConfig, findByColumn, upsertByClientId, sendTelegram, logAdminMessage, pauseAfterHumanReply, type Row } from "@/lib/n8n";
import { TASK_COMPLETION, TASK_IDS, type TaskId } from "@/lib/task-messages";

export async function findClient(clientId: string): Promise<Row | undefined> {
  return findByColumn(n8nConfig().tables.clients, "client_id", clientId);
}

export function completedOf(row?: Row): string[] {
  try { const v = JSON.parse(String(row?.completed_tasks || "[]")); if (Array.isArray(v)) return v.map(String); } catch {}
  return [];
}

export class StepError extends Error { constructor(message: string, public detail = "") { super(message); } }

export async function completeTask(clientId: string, taskId: TaskId, sendMessages: boolean, row?: Row) {
  const cfg = n8nConfig();
  if (!row) {
    try { row = await findClient(clientId); }
    catch (error) { throw new StepError("Could not read client progress.", error instanceof Error ? error.message : ""); }
  }
  const completed = completedOf(row);
  const index = TASK_IDS.indexOf(taskId);
  // Completing a later task also records the earlier ones, so the order stays consistent.
  for (const id of TASK_IDS.slice(0, index + 1)) if (!completed.includes(id)) completed.push(id);

  const plan = TASK_COMPLETION[taskId];
  try {
    await upsertByClientId(cfg.tables.clients, clientId, {
      completed_tasks: JSON.stringify(completed),
      current_task: plan.next.current_task,
      flow_step: plan.next.flow_step,
      next_task_allowed: plan.next.next_task_allowed,
      proof_status: "approved",
      last_submission_id: `dashboard_${Date.now().toString(36)}`,
      [plan.stampColumn]: new Date().toISOString(),
    });
  } catch (error) {
    throw new StepError("Could not update client progress.", error instanceof Error ? error.message : "");
  }

  const sent: string[] = [];
  const failed: string[] = [];
  let aiPausedNow = false;
  if (sendMessages) {
    // Hand the chat to humans while the messages go out (runs in parallel).
    const pausing = pauseAfterHumanReply(clientId).then(r => { aiPausedNow = r.changed; }).catch(() => undefined);
    const logs: Promise<unknown>[] = [];
    for (const text of plan.messages) {
      try {
        const result = await sendTelegram(clientId, text); // in order: the user must see them in sequence
        sent.push(text);
        logs.push(logAdminMessage(clientId, text, String(result?.message_id || ""), "manual_admin_task", taskId).catch(() => undefined));
      } catch (error) {
        failed.push(error instanceof Error ? error.message : "send failed");
        break;
      }
    }
    await Promise.all([pausing, ...logs]);
  }
  return { completed, next: plan.next, sentCount: sent.length, failed, aiPausedNow };
}
