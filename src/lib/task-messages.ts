// Same texts the n8n workflow sends automatically (kept in sync with the workflow nodes
// "Send WhatsApp Group Message After Angel One", "Send Choice FinX Task After Auto Verify",
// "Task 3 Pre-Message - Auto", "Send Bajaj Task After Choice Auto Verify", "Send Bajaj Completion Message").

import { IS_AISHA } from "@/lib/brand";

export const TASK1_LINK = IS_AISHA
  ? "📌 Name: HDFC SKY ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=89\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌1ST\n\n📝 Name: ANGEL ONE ✅\nGet- ₹100/- Reward for You\n\n🔗 Link: https://tinyurl.com/Angel-Demat-Sana\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

const GROUP_LINK = IS_AISHA ? "https://chat.whatsapp.com/IjHGPPvbDjhB2rWcQ3pDM1" : "https://chat.whatsapp.com/I1bRcqgxBZwJsWPbvaQg9O";

export const WHATSAPP_GROUP = "Ok, brother apka yeh saare applications pending for approval stage main hain yeh saare applications approved hote hi ham apko apne taraf se message karke apka payment proceed karwa denge 🛡️\n\nAccount Active Hone me (48 hour) lagenge 📌\n\nTab tak aap ye Group Join Kar Lijiye, Saare Update Apko ishi me milenge✅\n\n📌 Join : 🔗 " + GROUP_LINK;

export const TASK2_LINK = IS_AISHA
  ? "📌2ND\n\n📝 Name: CHOICE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choice-aisha\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌 TASK - 2\n\n📝 Name: CHOICE FINX ✅\n\n🔗 Link: https://formlie.in/form/Y32qM1?r=Choice11Sana\n\n✅ Link pe click karke account open karke screenshot dijiye. Koi problem aaye to screenshot bhej dijiye, mai guide kar dunga.";

/** Aisha: HDFC SKY as the second task, for users who did Choice first. */
const HDFC_AS_SECOND = "📌2ND\n\n📝 Name: HDFC SKY ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=89\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";
/** Aisha: Choice as a pasted reply, without a task number. */
const CHOICE_PLAIN = "📌 Name: CHOICE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choice-aisha\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

/** Aisha: sent after the first of HDFC SKY / Choice, before the second link (no group link here). */
const FIRST_DONE = "Apka 1st task complete ho gya hai ✅\n\nAb bas 2 task aur baaki hain. Teeno task complete karne par aapko ₹1,500 milenge 💰\n\nNeeche diya gaya 2nd task abhi complete kar lijiye 👇";

export const TASK3_PRE = IS_AISHA
  ? "Apka 2nd task complete ho gya hai ✅\n\n3rd task jald hi aapko yahin mil jayega 🙏 Tab tak WhatsApp group join karke rakhiye, updates wahin milenge.\n\n📌 Join : 🔗 " + GROUP_LINK
  : "Apka 2nd task complete ho gya hai , mai apko 3rd task ka link deta hu wait";

export const TASK3_LINK = "📌 TASK - 3\n📝 Name: BAJAJ ✅ \n\n\n🔗 Link: https://partners.marcadeo.com/click?oid=72&uid=823&aff_sub=533\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const BAJAJ_DONE = "✅ Bajaj task complete ho gaya hai!\n\n📩 Aage ke updates WhatsApp group par milenge. Group join karke rakhein.\n\nNote: Account activation aur payment ka final status provider/admin ke update par depend karega.";

/** Aisha has no Task 3 yet: the dashboard must not send it or mark it complete. */
export const TASK3_ON_HOLD = IS_AISHA;

/** What the Aarohi admin is told the user will receive when a task is completed (by task order). */
const NEXT_TEXT: string[] = ["WhatsApp group message + Task 2 (Choice FinX) link", "\"2nd task complete\" message + Task 3 (Bajaj) link", "Bajaj completion message"];

export const TASK_IDS = ["task_1_angel_one", "task_2_choice_finx", "task_3"] as const;
export type TaskId = (typeof TASK_IDS)[number];

/** What happens when the admin marks a task complete from the dashboard. */
export const TASK_COMPLETION: Record<TaskId, { next: { current_task: string; flow_step: string; next_task_allowed: boolean }; stampColumn: string; messages: string[] }> = {
  task_1_angel_one: { next: { current_task: "task_2_choice_finx", flow_step: "task_2_active", next_task_allowed: true }, stampColumn: "task_1_completed_at", messages: [WHATSAPP_GROUP, TASK2_LINK] },
  task_2_choice_finx: IS_AISHA
    ? { next: { current_task: "task_3", flow_step: "task_3_waiting", next_task_allowed: false }, stampColumn: "task_2_completed_at", messages: [TASK3_PRE] }
    : { next: { current_task: "task_3", flow_step: "task_3_active", next_task_allowed: true }, stampColumn: "task_2_completed_at", messages: [TASK3_PRE, TASK3_LINK] },
  task_3: { next: { current_task: "completed", flow_step: "all_tasks_completed", next_task_allowed: false }, stampColumn: "task_3_completed_at", messages: [BAJAJ_DONE] },
};

type Plan = (typeof TASK_COMPLETION)[TaskId];
const WAIT_NEXT = { current_task: "task_3", flow_step: "task_3_waiting", next_task_allowed: false };

/**
 * What completing this task does. Aarohi has a fixed order. Aisha's users do HDFC SKY and Choice in
 * either order (new users: Choice first), so the next step depends on what is already done or skipped.
 */
export function completionPlan(taskId: TaskId, completed: string[] = [], skipped: string[] = []): Plan {
  const fixed = TASK_COMPLETION[taskId];
  if (!IS_AISHA || taskId === "task_3") return fixed;
  const other: TaskId = taskId === "task_1_angel_one" ? "task_2_choice_finx" : "task_1_angel_one";
  if (completed.includes(other) || skipped.includes(other)) return { next: WAIT_NEXT, stampColumn: fixed.stampColumn, messages: [TASK3_PRE] };
  return other === "task_2_choice_finx"
    ? { next: { current_task: "task_2_choice_finx", flow_step: "task_2_active", next_task_allowed: true }, stampColumn: fixed.stampColumn, messages: [FIRST_DONE, TASK2_LINK] }
    : { next: { current_task: "task_1_angel_one", flow_step: "task_1_active", next_task_allowed: true }, stampColumn: fixed.stampColumn, messages: [FIRST_DONE, HDFC_AS_SECOND] };
}

/** What the admin is told the user will receive when this task is completed. */
export function nextTextFor(taskId: TaskId, completed: string[] = [], skipped: string[] = []): string {
  if (!IS_AISHA) return NEXT_TEXT[TASK_IDS.indexOf(taskId)];
  if (taskId === "task_3") return "Task 3 abhi band hai";
  const next = completionPlan(taskId, completed, skipped).next.current_task;
  if (next === "task_1_angel_one") return "\"1st task complete\" message + HDFC SKY link";
  if (next === "task_2_choice_finx") return "\"1st task complete\" message + Choice link";
  return "\"2nd task complete, 3rd task jald\" message + WhatsApp group link";
}

/** Ready-made replies for the dashboard composer (useful in Human mode). */
export const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: IS_AISHA ? "HDFC SKY link" : "Task 1 link", text: TASK1_LINK },
  { label: IS_AISHA ? "Choice link" : "Task 2 link", text: IS_AISHA ? CHOICE_PLAIN : TASK2_LINK },
  { label: "Task 3 link", text: TASK3_LINK },
  { label: "App login", text: "Play Store se Angel One app download karke uske Home Page ka screenshot bhej dijiye.\n\n📲 Play Store Link: https://play.google.com/store/apps/details?id=com.msf.angelmobile&hl=en" },
  { label: "Group link", text: "WhatsApp group join kar lijiye, saare updates yahin milenge ✅\n🔗 " + GROUP_LINK },
  { label: "Screenshot bhejo", text: IS_AISHA ? "Account open hone ke baad final screen ka screenshot bhej dijiye 🙂\n\nHDFC SKY: \"We have received your details\" wala screen ya Home screen.\nChoice: Home screen jahan aapka naam aur \"Account Activation in Progress\" ya \"Account Setup ✅\" dikhe." : "Account open hone ke baad profile page ka screenshot bhej dijiye jahan aapka naam aur Client ID dikhe 🙂" },
  { label: "No deposit", text: "Paise add karne ki koi zarurat nahi hai 🙂 Bas account open karke screenshot bhej dijiye." },
  { label: "Bonus info", text: "Aapka bonus hum khud dete hain 😊 Har completed task ka " + (IS_AISHA ? "₹500" : "₹100") + " milta hai. Minimum 3 tasks complete hone ke baad, applications approve hote hi hum khud message karke payment karwa denge." },
].filter(q => !(IS_AISHA && (q.label === "Task 3 link" || q.label === "App login")));
