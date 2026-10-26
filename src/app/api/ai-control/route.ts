import { NextResponse } from "next/server";
import { requireAdmin, jsonError, privateJsonHeaders } from "@/lib/auth";
import { n8nConfig, upsertByClientId, GLOBAL_CONTROL_ID } from "@/lib/n8n";

// clientId = a Telegram user ID (pause AI for one user) or "global" (Human mode for everyone:
// the workflow stops all automatic replies for users who already got Task 1; onboarding keeps working).
export async function POST(req: Request) {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return jsonError("Cross-origin request denied", 403);

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  const action = String(body.action || "");
  const isGlobal = clientId === GLOBAL_CONTROL_ID;
  if (!isGlobal && !/^\d{1,24}$/.test(clientId)) return jsonError("Invalid Telegram user ID");
  if (action !== "pause" && action !== "resume") return jsonError("Action must be pause or resume");

  const cfg = n8nConfig();
  if (!cfg.configured) return NextResponse.json({ updated: false, error: "n8n API is not configured on the server." }, { status: 503, headers: privateJsonHeaders });

  const paused = action === "pause";
  try {
    const result = await upsertByClientId(cfg.tables.controls, clientId, {
      ai_paused: paused,
      paused_by: "dashboard_admin",
      paused_at: paused ? new Date().toISOString() : null,
      reason: isGlobal
        ? (paused ? "HUMAN_MODE: AI off for everyone from dashboard" : "Global AI turned on from dashboard")
        : (paused ? "HUMAN_PAUSE: Paused from Aarohi dashboard" : "Resumed from Aarohi dashboard"),
    });
    return NextResponse.json({ updated: true, clientId, paused, result }, { headers: privateJsonHeaders });
  } catch (error) {
    return NextResponse.json({ updated: false, error: "Could not update AI control state in n8n.", detail: error instanceof Error ? error.message : "" }, { status: 502, headers: privateJsonHeaders });
  }
}
