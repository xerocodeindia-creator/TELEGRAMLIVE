import { BOT_NAME, APP_ICON_DIR, APP_THEME_COLOR } from "@/lib/brand";

export const dynamic = "force-static";

// Web app manifest so the dashboard can be installed on the phone home screen.
export function GET() {
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
    theme_color: APP_THEME_COLOR,
    icons: [
      { src: `${APP_ICON_DIR}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${APP_ICON_DIR}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${APP_ICON_DIR}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
