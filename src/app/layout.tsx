import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarohi Control Center",
  description: "Private operations dashboard for Aarohi Telegram automation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
