import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarohi Control Center",
  description: "Private operations dashboard for Aarohi Telegram automation.",
};

// Applies the saved theme (or the system preference) before the page paints, so dark mode doesn't flash light first.
const themeScript = `(function(){try{var t=localStorage.getItem("aarohi-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
