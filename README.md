# Aarohi Control Center

This repository is intended for the private admin dashboard for the Aarohi Telegram bot and the n8n Client Progress Manager workflow.

## Goals
- Live conversation inbox: inbound Telegram messages and outbound bot replies.
- Client progress: current task, completed tasks, screenshot submissions, verification outcome, and last activity.
- AI activity and workflow errors: analysis result, route chosen, admin-notification delivery, and failed runs.
- Per-user AI pause/resume and admin manual replies.

## Current integration notes
- Existing n8n workflow: `Client Progress Manager` (workflow ID: `FlrM2n4gfrGFgQFF`).
- Existing workflow uses the `client_progress` and `task_submissions` data tables.
- Existing webhook path: `anychat-client-progress`; inspect the webhook's authenticated deployment URL in n8n before configuring integrations.
- Telegram updates currently arrive through the existing Telegram Trigger. The dashboard must not register a second Telegram webhook on the same bot token, because that can break the existing bot trigger.
- The current workflow does not yet provide a full, durable log of every incoming and outgoing conversation message. Add message logging at the existing inbound/outbound points first.

## Proposed architecture
1. Keep the current Telegram Trigger as the sole Telegram update receiver.
2. Add persistent `conversation_messages` and `user_controls` tables. Store sender, chat ID, Telegram message ID, direction, text/caption, media metadata/file ID, event time, and delivery status. Avoid storing OTPs, passwords, or banking secrets.
3. Log inbound events and every outbound reply in the current n8n workflow. Log send success/failure only after the Telegram node result is known.
4. Provide authenticated backend endpoints for dashboard queries, manual sends, and per-user pause/resume. Verify an admin session server-side; never ship Telegram bot tokens, n8n API keys, or database credentials to browser JavaScript.
5. Deploy the frontend through Vercel/GitHub. Configure server-only environment variables in Vercel after an authenticated backend is ready.
6. Add real-time updates using short polling first; move to server-sent events or WebSockets only if needed.

## Security requirements
- Admin-only access.
- Server-side authorization for every endpoint, especially manual messaging and AI pause/resume.
- Per-user pause state; a paused user must not receive automated replies while still allowing admin replies.
- Auditable admin actions and idempotent message logging.
- Do not expose n8n webhook URLs with privileged actions, Telegram tokens, phone numbers, or screenshot file IDs to public clients.
- Treat screenshots and AI classifications as untrusted input. A dashboard label must not independently approve a financial account or promise payments.

## Implementation status
This README is a plan only. The dashboard application and its secure backend have not yet been implemented or deployed.
