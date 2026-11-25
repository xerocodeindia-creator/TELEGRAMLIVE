// Same texts the n8n workflow sends automatically (kept in sync with the workflow nodes
// "Send WhatsApp Group Message After Angel One", "Send Choice FinX Task After Auto Verify",
// "Task 3 Pre-Message - Auto", "Send Bajaj Task After Choice Auto Verify", "Send Bajaj Completion Message").

import { IS_AISHA } from "@/lib/brand";

export const TASK1_LINK = IS_AISHA
  ? "📌 Name: HDFC SKY ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/hdfcskylaxkar\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌1ST\n\n📝 Name: ANGEL ONE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/angeloneashu\n\n\n1️⃣ Link par click karein.\n2️⃣ Account opening process complete karein.\n3️⃣ Complete hone ke baad screenshot send karein.\n\n🤝 Process ke beech mein koi dikkat aaye toh tension na lein, screenshot bhejein. Main aapko step-by-step guide kar dungi.\n\n📍 Note: Agar aapka Angel One account pehle se hai, toh SKIP likhkar send karein.";

const GROUP_LINK = IS_AISHA ? "https://chat.whatsapp.com/IjHGPPvbDjhB2rWcQ3pDM1" : "https://chat.whatsapp.com/Jz0Kx2uavz00tlPinKYgmH";

export const WHATSAPP_GROUP = IS_AISHA
  ? "Okay Brother! ❤️\n\nAapka 1st Task abhi Pending for Approval stage mein hai. Jaise hi task approve hota hai, hamari team aapko directly Telegram par message karke aapka payment process kar degi. 💸\n\n‼️ Important: Payment receive karne ke liye minimum 2 tasks complete karna compulsory hai. Sirf 1 task complete karne par koi payment nahi milega.\n\n📌 Account Active hone mein maximum 48 hours lag sakte hain.\n\nTab tak aap hamara WhatsApp Group join kar lijiye. Saare important updates aur further instructions aapko isi group mein milenge. ✅\n\n🔗 Join Group: " + GROUP_LINK + "\n\n👇 Ab neeche diya gaya 2nd task complete kijiye"
  : "Okay Brother! ❤️\n\nAapka 1st Task abhi Pending for Approval stage mein hai. Jaise hi task approve hota hai, hamari team aapko directly Telegram par message karke aapka payment process kar degi. 💸\n\n‼️ Important: Payment receive karne ke liye minimum 3 tasks complete karna compulsory hai.\n\n📌 Account Active hone mein maximum 48 hours lag sakte hain.\n\nTab tak aap hamara WhatsApp Group join kar lijiye. Saare important updates aur further instructions aapko isi group mein milenge. ✅\n\n🔗 Join Group: " + GROUP_LINK + "\n\n👇 Ab neeche diya gaya next task complete kijiye";

export const TASK2_LINK = IS_AISHA
  ? "📌2ND\n\n📝 Name: CHOICE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choice-aisha\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌 TASK - 2\n\n📝 Name: CHOICE FINX ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choicemira\n\n1️⃣ Link par click karein.\n2️⃣ Account opening process complete karein.\n3️⃣ Complete hone ke baad screenshot send karein.\n\n🤝 Process ke beech mein koi dikkat aaye toh tension na lein, screenshot bhejein. Main aapko step-by-step guide kar dungi.";

/** Aisha: HDFC SKY as the second task, for users who did Choice first. */
const HDFC_AS_SECOND = "📌2ND\n\n📝 Name: HDFC SKY ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/hdfcskylaxkar\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";
/** Aisha: Choice as a pasted reply, without a task number. */
const CHOICE_PLAIN = "📌 Name: CHOICE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choice-aisha\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const TASK3_PRE = IS_AISHA
  ? "Apka 2nd task complete ho gya hai ✅\n\nAb aapka 3rd task 👇\n\n📌 TASK - 3 \n\nReward - 500₹\n\n📝 Name: BAJAJ BROKING ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=123\n\n\n✅ Link pe click karke account open karke screenshot dijiye. Koi problem aaye to screenshot bhej dijiye, mai guide kar dungi."
  : "Apka 2nd task complete ho gya hai , mai apko 3rd task ka link deta hu wait";

export const TASK3_LINK = IS_AISHA
  ? "📌 TASK - 3 \n\nReward - 500₹\n\n📝 Name: BAJAJ BROKING ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=123\n\n\n✅ Link pe click karke account open karke screenshot dijiye. Koi problem aaye to screenshot bhej dijiye, mai guide kar dungi."
  : "📌 TASK - 3\n📝 Name: BAJAJ ✅ \n\n\n🔗 Link: https://formtracker.in/form?id=254&ref=NASA1\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const BAJAJ_DONE = "✅ Bajaj task complete ho gaya hai!\n\n📩 Aage ke updates WhatsApp group par milenge. Group join karke rakhein.\n\nNote: Account activation aur payment ka final status provider/admin ke update par depend karega.";

/** Task 3 (Bajaj) is live for both bots (Aisha since 14 Nov 2026). */
export const TASK3_ON_HOLD = false;

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
const DONE_NEXT = { current_task: "completed", flow_step: "all_tasks_completed", next_task_allowed: false };
const HDFC_NEXT = { current_task: "task_1_angel_one", flow_step: "task_1_active", next_task_allowed: true };
const CHOICE_NEXT = { current_task: "task_2_choice_finx", flow_step: "task_2_active", next_task_allowed: true };
const END_LINE = "\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";
const hdfcTask = (label: string) => "📌" + label + "\n\n📝 Name: HDFC SKY ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/hdfcskylaxkar" + END_LINE;
const choiceTask = (label: string) => "📌" + label + "\n\n📝 Name: CHOICE ✅\n\n🔗 Link: https://formtraceker.vercel.app/r/choice-aisha" + END_LINE;
/** Aisha: sent when the last open task is done (same text as the workflow's "Send All Done After HDFC/Choice"). */
const ALL_DONE = "✅ Aapke saare tasks complete ho gaye hain! 🎉\n\n📩 Aage ke updates WhatsApp group par milenge. Group join karke rakhein.\n\nNote: Account activation aur payment ka final status provider/admin ke update par depend karega.";

/**
 * What completing this task does. Aarohi has a fixed order. Aisha mirrors the workflow: from 26 Nov 2026
 * new users do HDFC SKY → Choice → Bajaj (16–25 Nov: Bajaj → HDFC SKY → Choice; earlier: Choice → HDFC SKY → Bajaj), so the next step depends
 * on what is already done or skipped. The WhatsApp group message goes only after the user's first task.
 */
export function completionPlan(taskId: TaskId, completed: string[] = [], skipped: string[] = []): Plan {
  const fixed = TASK_COMPLETION[taskId];
  if (!IS_AISHA) return fixed;
  const done = [...completed.filter(t => t !== taskId), taskId];
  const isFirst = done.length === 1;
  const open = (id: string) => !done.includes(id) && !skipped.includes(id);
  const label = ["1ST", "2ND", "3RD"][Math.min(done.length, 2)];
  const stampColumn = fixed.stampColumn;
  const withGroup = (m: string) => (isFirst ? [WHATSAPP_GROUP, m] : [m]);
  if (taskId === "task_3") {
    if (open("task_1_angel_one")) return { next: HDFC_NEXT, stampColumn, messages: withGroup(hdfcTask(label)) };
    if (open("task_2_choice_finx")) return { next: CHOICE_NEXT, stampColumn, messages: withGroup(choiceTask(label)) };
    return { next: DONE_NEXT, stampColumn, messages: [BAJAJ_DONE] };
  }
  if (taskId === "task_1_angel_one") {
    if (open("task_2_choice_finx")) return { next: CHOICE_NEXT, stampColumn, messages: withGroup(isFirst ? TASK2_LINK : choiceTask(label)) };
    if (open("task_3")) return { next: WAIT_NEXT, stampColumn, messages: [TASK3_PRE] };
    return { next: DONE_NEXT, stampColumn, messages: [ALL_DONE] };
  }
  if (open("task_1_angel_one")) return { next: HDFC_NEXT, stampColumn, messages: [WHATSAPP_GROUP, HDFC_AS_SECOND] };
  if (open("task_3")) return { next: WAIT_NEXT, stampColumn, messages: [TASK3_PRE] };
  return { next: DONE_NEXT, stampColumn, messages: [ALL_DONE] };
}

/** What the admin is told the user will receive when this task is completed. */
export function nextTextFor(taskId: TaskId, completed: string[] = [], skipped: string[] = []): string {
  if (!IS_AISHA) return NEXT_TEXT[TASK_IDS.indexOf(taskId)];
  const plan = completionPlan(taskId, completed, skipped);
  const group = plan.messages.includes(WHATSAPP_GROUP) ? "WhatsApp group message + " : "";
  const next = plan.next.current_task;
  if (next === "task_1_angel_one") return group + "HDFC SKY link";
  if (next === "task_2_choice_finx") return group + "Choice link";
  if (next === "task_3") return "\"2nd task complete\" + Bajaj Task 3 link";
  return taskId === "task_3" ? "Bajaj completion message" : "All tasks complete message";
}

/** Ready-made replies for the dashboard composer (useful in Human mode). */
export const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: IS_AISHA ? "HDFC SKY link" : "Task 1 link", text: TASK1_LINK },
  { label: IS_AISHA ? "Choice link" : "Task 2 link", text: IS_AISHA ? CHOICE_PLAIN : TASK2_LINK },
  { label: IS_AISHA ? "Bajaj link" : "Task 3 link", text: IS_AISHA ? "📌 Name: BAJAJ BROKING ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=123" + END_LINE : TASK3_LINK },
  { label: "App login", text: "Play Store se Angel One app download karke uske Home Page ka screenshot bhej dijiye.\n\n📲 Play Store Link: https://play.google.com/store/apps/details?id=com.msf.angelmobile&hl=en" },
  { label: "Group link", text: "WhatsApp group join kar lijiye, saare updates yahin milenge ✅\n🔗 " + GROUP_LINK },
  { label: "Screenshot bhejo", text: IS_AISHA ? "Account open hone ke baad final screen ka screenshot bhej dijiye 🙂\n\nHDFC SKY: \"We have received your details\" wala screen ya Home screen.\nChoice: Home screen jahan aapka naam aur \"Account Activation in Progress\" ya \"Account Setup ✅\" dikhe." : "Account open hone ke baad profile page ka screenshot bhej dijiye jahan aapka naam aur Client ID dikhe 🙂" },
  { label: "No deposit", text: "Paise add karne ki koi zarurat nahi hai 🙂 Bas account open karke screenshot bhej dijiye." },
  { label: "Bonus info", text: "Aapka bonus hum khud dete hain 😊 Har completed task ka " + (IS_AISHA ? "₹500" : "₹100") + " milta hai. Minimum " + (IS_AISHA ? "2" : "3") + " tasks complete hone ke baad, applications approve hote hi hum khud message karke payment karwa denge." },
].filter(q => !(IS_AISHA && q.label === "App login"));
