import { insertRows } from "@/lib/n8n";
import { IS_AISHA } from "@/lib/brand";

// Aisha team app: one row per trade step (payment_sent / done / not_interested / back_to_tq), kept for reporting.
// Rows of a finished month are deleted only after the admin says "Haan" on Telegram (n8n monthly ask).
// aisha_trade_history / aarohi_trade_history
export const TRADE_HISTORY_TABLE = IS_AISHA ? "4ocBRPmHG2W93Lmr" : "xxKDoB65wPW6JiEM";
const IST = 5.5 * 3600 * 1000;

export async function logTradeEvent(clientId: string, name: string, event: string, campaign: string, by: string, atIso: string) {
  const month = new Date(Date.parse(atIso) + IST).toISOString().slice(0, 7);
  try {
    await insertRows(TRADE_HISTORY_TABLE, [{ client_id: clientId, name, event, campaign, by, at: atIso, month }]);
    return true;
  } catch (error) {
    console.log(`[trade-history] insert failed ${clientId} ${event}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
