// Same texts the n8n workflow sends automatically (kept in sync with the workflow nodes
// "Send WhatsApp Group Message After Angel One", "Send Choice FinX Task After Auto Verify",
// "Task 3 Pre-Message - Auto", "Send Bajaj Task After Choice Auto Verify", "Send Bajaj Completion Message").

export const TASK1_LINK = "📌1ST\n\n📝 Name: ANGEL ONE ✅\nGet- ₹100/- Reward for You\n\n🔗 Link: https://tinyurl.com/AngelDemat-Aarohi-Link\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const WHATSAPP_GROUP = "Ok, brother apka yeh saare applications pending for approval stage main hain yeh saare applications approved hote hi ham apko apne taraf se message karke apka payment proceed karwa denge 🛡️\n\nAccount Active Hone me (48 hour) lagenge 📌\n\nTab tak aap ye Group Join Kar Lijiye, Saare Update Apko ishi me milenge✅\n\n📌 Join : 🔗 https://chat.whatsapp.com/DU1HnockcVz3P24RiuW6pB";

export const TASK2_LINK = "📌 TASK - 2\n\n📝 Name: CHOICE FINX ✅\n\n🔗 Link: https://FormTracker.in/form?id=807\n\n✅ Link pe click karke account open karke screenshot dijiye. Koi problem aaye to screenshot bhej dijiye, mai guide kar dunga.";

export const TASK3_PRE = "Apka 2nd task complete ho gya hai , mai apko 3rd task ka link deta hu wait";

export const TASK3_LINK = "📌 TASK - 3\n📝 Name: BAJAJ ✅ \n\n\n🔗 Link: https://partners.marcadeo.com/click?oid=72&uid=823&aff_sub=533\n\n✅ Link pe Click karke Account open krke screenshot dijiye. Koi problem aaye to screenshot bhej dena, mai guide kr dungi";

export const BAJAJ_DONE = "✅ Bajaj task complete ho gaya hai!\n\n📩 Aage ke updates WhatsApp group par milenge. Group join karke rakhein.\n\nNote: Account activation aur payment ka final status provider/admin ke update par depend karega.";

export const TASK_IDS = ["task_1_angel_one", "task_2_choice_finx", "task_3"] as const;
export type TaskId = (typeof TASK_IDS)[number];

/** What happens when the admin marks a task complete from the dashboard. */
export const TASK_COMPLETION: Record<TaskId, { next: { current_task: string; flow_step: string; next_task_allowed: boolean }; stampColumn: string; messages: string[] }> = {
  task_1_angel_one: { next: { current_task: "task_2_choice_finx", flow_step: "task_2_active", next_task_allowed: true }, stampColumn: "task_1_completed_at", messages: [WHATSAPP_GROUP, TASK2_LINK] },
  task_2_choice_finx: { next: { current_task: "task_3", flow_step: "task_3_active", next_task_allowed: true }, stampColumn: "task_2_completed_at", messages: [TASK3_PRE, TASK3_LINK] },
  task_3: { next: { current_task: "completed", flow_step: "all_tasks_completed", next_task_allowed: false }, stampColumn: "task_3_completed_at", messages: [BAJAJ_DONE] },
};

/** Ready-made replies for the dashboard composer (useful in Human mode). */
export const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: "Task 1 link", text: TASK1_LINK },
  { label: "Task 2 link", text: TASK2_LINK },
  { label: "Task 3 link", text: TASK3_LINK },
  { label: "Group link", text: "WhatsApp group join kar lijiye, saare updates yahin milenge ✅\n🔗 https://chat.whatsapp.com/DU1HnockcVz3P24RiuW6pB" },
  { label: "Screenshot bhejo", text: "Account open hone ke baad profile page ka screenshot bhej dijiye jahan aapka naam aur Client ID dikhe 🙂" },
  { label: "No deposit", text: "Paise add karne ki koi zarurat nahi hai 🙂 Bas account open karke screenshot bhej dijiye." },
  { label: "Bonus info", text: "Aapka bonus hum khud dete hain 😊 Har completed task ka ₹100 milta hai. Minimum 3 tasks complete hone ke baad, applications approve hote hi hum khud message karke payment karwa denge." },
];
