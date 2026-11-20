import { IS_AISHA, BOT_NAME } from "@/lib/brand";

export const dynamic = "force-static";

// Aisha only: web app manifest so the dashboard can be installed on the phone home screen.
export function GET() {
  if (!IS_AISHA) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify({
    name: `${BOT_NAME} Control Center`,
    short_name: BOT_NAME,
    description: `${BOT_NAME} Telegram bot dashboard`,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f141d",
    theme_color: "#3a6fd8",
    icons: [
      { src: "/aisha/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/aisha/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/aisha/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
