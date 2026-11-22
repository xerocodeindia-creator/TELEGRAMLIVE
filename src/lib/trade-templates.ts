// Aisha team app: the message sent together with the payment screenshot, per trade campaign.
// Add a campaign here (key, name shown in the app, message) — the app picks it up without a new APK.
export type TradeTemplate = { key: string; name: string; message: string };

export const TRADE_TEMPLATES: TradeTemplate[] = [
  {
    key: "choice",
    name: "Choice",
    message: "Search Share name\n(Idea)\nAND 1st wala select kriye...\nThen quantity 1\nSelect - Market price \nDelivery mein tick krke buy kriye then screenshot bhjeye!! ☺️",
  },
];
