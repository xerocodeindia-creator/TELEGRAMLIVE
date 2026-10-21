# Aarohi Control Center

Private admin dashboard for the Aarohi Telegram bot and the n8n `Client Progress Manager` workflow.

## Current status

The initial Next.js dashboard UI, admin login/session endpoint, protected progress-data endpoint, manual Telegram reply endpoint, and an intentionally disabled AI-control endpoint are now in the repository. **This is not yet a live, production-ready dashboard.** No live chat log is displayed until the n8n workflow logs inbound and outbound messages. AI pause/resume will remain disabled until the control table and pause guard are installed in the live workflow.

## Features in the first UI build
- Responsive conversation inbox and client/task progress view.
- Admin login using a server-side password and signed HTTP-only cookie.
- Server-side endpoint to read n8n client progress and task submissions.
- Server-side Telegram manual-reply endpoint.
- AI pause/resume control UI, currently blocked by an explicit 503 response until the live n8n pause guard is implemented.

Sample rows in the dashboard are clearly marked as preview data and must not be mistaken for real users.

## Existing integration
- n8n workflow: `Client Progress Manager` (workflow ID `FlrM2n4gfrGFgQFF`).
- Existing data table IDs: `client_progress` = `yC8taftOgA9mXftw`; `task_submissions` = `trjvYIR4ee5ZpWas`.
- Existing webhook path: `anychat-client-progress`. Do not expose a privileged n8n webhook directly to the browser.
- Telegram updates currently arrive through the existing Telegram Trigger. Do not register a second Telegram webhook on the same bot token.

## Vercel environment variables

Configure these as **server-only** environment variables in Vercel (never prefix them with `NEXT_PUBLIC_`):

- `DASHBOARD_ADMIN_PASSWORD`: a new, strong password used only for this dashboard.
- `DASHBOARD_SESSION_SECRET`: a cryptographically random secret, at least 32 bytes.
- `N8N_BASE_URL`: base URL of the self-hosted n8n instance, with no trailing slash.
- `N8N_API_KEY`: n8n API key with only the needed access.
- `N8N_CLIENT_PROGRESS_TABLE_ID`: optional; defaults to the existing client_progress table ID.
- `N8N_TASK_SUBMISSIONS_TABLE_ID`: optional; defaults to the existing task_submissions table ID.
- `TELEGRAM_BOT_TOKEN`: bot token needed for manual Telegram replies; keep it only in the server environment.
- `N8N_USER_CONTROLS_TABLE_ID`: intentionally not sufficient by itself; set it only after creating the table and installing/validating the live workflow pause guard.

Do not commit real environment values or share secrets in chat.

## Remaining integration work
1. Add a durable `conversation_messages` table and log inbound Telegram updates and all outgoing bot/admin messages. Store event time, Telegram message ID, direction, user/chat ID, text/caption, media metadata, and delivery status. Never log OTPs, passwords, PINs, or other authentication secrets.
2. Connect the dashboard message view to that log, including pagination for long conversations.
3. Create a `user_controls` data table and add a per-user pause guard before the current workflow's automated text and photo branches. The dashboard endpoint deliberately returns an error until this is validated.
4. Add audited admin actions and confirm the outgoing Telegram send result before showing messages as sent.
5. Finish Vercel project linking and deployment after the Vercel account connection has permission for the intended team.
6. Run build checks and end-to-end tests for login, read-only data, manual reply, pause/resume, and multi-task progress.

## Conversation inbox troubleshooting

- The dashboard reads progress rows and message rows from the same n8n instance. Message rows are fetched with cursor pagination so recent conversations aren't hidden after the first page.
- The inbox includes Telegram IDs found in conversation history even if a progress row has not been written yet.
- Message matching uses Telegram chat ID, with user ID as a fallback only when chat ID is absent.
- Production verification should cover a new user sending `/start`, the welcome reply, a text reply, and the same user's dashboard conversation.

## Security requirements
- Every API route is admin-authenticated and checks cross-origin mutations.
- Telegram/n8n credentials remain server-side.
- Paused users must not receive automated replies, while manual admin replies remain available.
- Log actions and avoid claiming a message was sent unless Telegram confirms success.
- Screenshots and AI classifications are untrusted data; a dashboard label alone must not promise payment or represent broker-side account approval.
