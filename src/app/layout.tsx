import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BOT_NAME, IS_AISHA } from "@/lib/brand";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: `${BOT_NAME} Control Center`,
  description: `Private operations dashboard for ${BOT_NAME} Telegram automation.`,
  // Aisha: installable app (PWA). Aarohi keeps the plain page.
  ...(IS_AISHA ? {
    manifest: "/manifest.webmanifest",
    applicationName: BOT_NAME,
    appleWebApp: { capable: true, title: BOT_NAME, statusBarStyle: "default" as const },
    icons: { icon: "/aisha/favicon-48.png", apple: "/aisha/apple-touch-icon.png" },
  } : {}),
};

export const viewport: Viewport = IS_AISHA
  ? { themeColor: "#3a6fd8", width: "device-width", initialScale: 1 }
  : { width: "device-width", initialScale: 1 };

// Applies the saved theme (or the system preference) before the page paints, so dark mode doesn't flash light first.
const themeScript = `(function(){try{var t=localStorage.getItem("aarohi-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}{IS_AISHA && <PwaRegister />}</body>
    </html>
  );
}
