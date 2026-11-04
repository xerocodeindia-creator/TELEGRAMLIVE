// Same texts the n8n workflow sends automatically (kept in sync with the workflow nodes
// "Send WhatsApp Group Message After Angel One", "Send Choice FinX Task After Auto Verify",
// "Task 3 Pre-Message - Auto", "Send Bajaj Task After Choice Auto Verify", "Send Bajaj Completion Message").

import { IS_AISHA } from "@/lib/brand";

export const TASK1_LINK = IS_AISHA
  ? "📌1ST\n\n📝 Name: HDFC SKY ✅\n\n🔗 Link: https://uprisemedia.org/click?pub_id=22&camp_id=89\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌1ST\n\n📝 Name: ANGEL ONE ✅\nGet- ₹100/- Reward for You\n\n🔗 Link: https://tinyurl.com/Angel-Demat-Sana\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const WHATSAPP_GROUP = "Ok, brother apka yeh saare applications pending for approval stage main hain yeh saare applications approved hote hi ham apko apne taraf se message karke apka payment proceed karwa denge 🛡️\n\nAccount Active Hone me (48 hour) lagenge 📌\n\nTab tak aap ye Group Join Kar Lijiye, Saare Update Apko ishi me milenge✅\n\n📌 Join : 🔗 https://chat.whatsapp.com/I1bRcqgxBZwJsWPbvaQg9O";

export const TASK2_LINK = IS_AISHA
  ? "📌2ND\n\n📝 Name: CHOICE ✅\n\n🔗 Link: https://FormTracker.in/form?id=849\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi"
  : "📌 TASK - 2\n\n📝 Name: CHOICE FINX ✅\n\n🔗 Link: https://formlie.in/form/Y32qM1?r=Choice11Sana\n\n✅ Link pe click karke account open karke screenshot dijiye. Koi problem aaye to screenshot bhej dijiye, mai guide kar dunga.";

export const TASK3_PRE = IS_AISHA
  ? "Apka 2nd task complete ho gya hai ✅\n\n3rd task jald hi aapko yahin mil jayega 🙏 Tab tak WhatsApp group join karke rakhiye, updates wahin milenge."
  : "Apka 2nd task complete ho gya hai , mai apko 3rd task ka link deta hu wait";

export const TASK3_LINK = "📌 TASK - 3\n📝 Name: BAJAJ ✅ \n\n\n🔗 Link: https://partners.marcadeo.com/click?oid=72&uid=823&aff_sub=533\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const BAJAJ_DONE = "✅ Bajaj task complete ho gaya hai!\n\n📩 Aage ke updates WhatsApp group par milenge. Group join karke rakhein.\n\nNote: Account activation aur payment ka final status provider/admin ke update par depend karega.";

/** Aisha has no Task 3 yet: the dashboard must not send it or mark it complete. */
export const TASK3_ON_HOLD = IS_AISHA;

/** What the admin is told the user will receive when a task is completed (by task index). */
export const NEXT_TEXT: string[] = IS_AISHA
  ? ["WhatsApp group message + Task 2 (Choice) link", "\"2nd task complete, 3rd task jald\" message (koi link nahi)", "Task 3 abhi band hai"]
  : ["WhatsApp group message + Task 2 (Choice FinX) link", "\"2nd task complete\" message + Task 3 (Bajaj) link", "Bajaj completion message"];

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

/** Ready-made replies for the dashboard composer (useful in Human mode). */
export const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: "Task 1 link", text: TASK1_LINK },
  { label: "Task 2 link", text: TASK2_LINK },
  { label: "Task 3 link", text: TASK3_LINK },
  { label: "App login", text: "Play Store se Angel One app download karke uske Home Page ka screenshot bhej dijiye.\n\n📲 Play Store Link: https://play.google.com/store/apps/details?id=com.msf.angelmobile&hl=en" },
  { label: "Group link", text: "WhatsApp group join kar lijiye, saare updates yahin milenge ✅\n🔗 https://chat.whatsapp.com/I1bRcqgxBZwJsWPbvaQg9O" },
  { label: "Screenshot bhejo", text: IS_AISHA ? "Account open hone ke baad \"We have received your details\" wale screen ka screenshot bhej dijiye, ya HDFC SKY ke Home screen ka 🙂" : "Account open hone ke baad profile page ka screenshot bhej dijiye jahan aapka naam aur Client ID dikhe 🙂" },
  { label: "No deposit", text: "Paise add karne ki koi zarurat nahi hai 🙂 Bas account open karke screenshot bhej dijiye." },
  { label: "Bonus info", text: "Aapka bonus hum khud dete hain 😊 Har completed task ka ₹100 milta hai. Minimum 3 tasks complete hone ke baad, applications approve hote hi hum khud message karke payment karwa denge." },
].filter(q => !(IS_AISHA && (q.label === "Task 3 link" || q.label === "App login")));
