import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./global.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-studio-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-studio-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  description: "Terminal-first runtime for Shiro agent traces and live event streams.",
  title: "Shiro Studio",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body className="font-[family-name:var(--font-studio-sans)] antialiased">{children}</body>
    </html>
  );
}
