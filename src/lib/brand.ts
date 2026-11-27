// Bot display name. Set NEXT_PUBLIC_BOT_NAME per Vercel project (e.g. "Aisha"); defaults to Aarohi.
export const BOT_NAME = process.env.NEXT_PUBLIC_BOT_NAME || "Aarohi";
// Aisha runs different tasks than Aarohi (HDFC SKY + Choice, Task 3 on hold). Everything else is shared.
export const IS_AISHA = BOT_NAME === "Aisha";
// Installable app (PWA) icons and colour, per bot.
export const APP_ICON_DIR = IS_AISHA ? "/aisha" : "/aarohi";
export const APP_THEME_COLOR = IS_AISHA ? "#3a6fd8" : "#b0459b";

// Team app (Ashish Team for Aarohi, Team Dhruv for Aisha): per-bot values in one place (28 Nov 2026).
// Both bots now have the same team features: master admin, member-wise users, Done lock, bonus from the app.
// [completed_at column, app name] in task order. Aisha: task 1 = HDFC SKY, task 2 = Choice, task 3 = 3rd task (Axis Direct since 26 Nov; earlier this month Bajaj/Zerodha).
export const TEAM_APPS: [string, string][] = IS_AISHA
  ? [["task_1_completed_at", "HDFC SKY"], ["task_2_completed_at", "Choice"], ["task_3_completed_at", "3rd (Axis)"]]
  : [["task_1_completed_at", "Angel One"], ["task_2_completed_at", "Choice FinX"], ["task_3_completed_at", "Bajaj"]];
// n8n data table with team members (name, target, last_login). Env N8N_TEAM_MEMBERS_TABLE_ID wins if set.
export const TEAM_MEMBERS_TABLE = process.env.N8N_TEAM_MEMBERS_TABLE_ID || (IS_AISHA ? "M4iGVCqrbg0djBms" : "q53thl9awsWn2Z9A");
// Admin Telegram chat for reports and bonus summaries (same admin for both bots).
export const TEAM_ADMIN_CHAT = "905651310";
