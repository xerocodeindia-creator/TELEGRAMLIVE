// Bot display name. Set NEXT_PUBLIC_BOT_NAME per Vercel project (e.g. "Aisha"); defaults to Aarohi.
export const BOT_NAME = process.env.NEXT_PUBLIC_BOT_NAME || "Aarohi";
// Aisha runs different tasks than Aarohi (HDFC SKY + Choice, Task 3 on hold). Everything else is shared.
export const IS_AISHA = BOT_NAME === "Aisha";
