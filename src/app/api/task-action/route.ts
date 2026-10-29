import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig } from "@/lib/n8n";
import { TASK_IDS, type TaskId } from "@/lib/task-messages";
import { completeTask, StepError } from "@/lib/task-complete";

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
  if (!n8nConfig().configured) return jsonError("n8n API is not configured on the server.", 503);

  try {
    const r = await completeTask(clientId, taskId, sendMessages);
    return NextResponse.json({ updated: true, clientId, taskId, ...r }, { headers: privateJsonHeaders });
  } catch (error) {
    const e = error instanceof StepError ? error : new StepError("Task update failed", error instanceof Error ? error.message : "");
    return NextResponse.json({ error: e.message, detail: e.detail }, { status: 502, headers: privateJsonHeaders });
  }
}
