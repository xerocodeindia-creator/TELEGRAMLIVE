import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BOT_NAME, APP_ICON_DIR, APP_THEME_COLOR } from "@/lib/brand";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: `${BOT_NAME} Control Center`,
  description: `Private operations dashboard for ${BOT_NAME} Telegram automation.`,
  // Installable app (PWA) for both bots.
  ...({
    manifest: "/manifest.webmanifest",
    applicationName: BOT_NAME,
    appleWebApp: { capable: true, title: BOT_NAME, statusBarStyle: "default" as const },
    icons: { icon: `${APP_ICON_DIR}/favicon-48.png`, apple: `${APP_ICON_DIR}/apple-touch-icon.png` },
  }),
};

export const viewport: Viewport = { themeColor: APP_THEME_COLOR, width: "device-width", initialScale: 1 };

// Applies the saved theme (or the system preference) before the page paints, so dark mode doesn't flash light first.
const themeScript = `(function(){try{var t=localStorage.getItem("aarohi-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
