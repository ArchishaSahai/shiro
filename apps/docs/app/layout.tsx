import "fumadocs-ui/css/neutral.css";
import "fumadocs-ui/css/preset.css";
import "./global.css";

import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description: "Production-ready TypeScript Agent SDK.",
  title: {
    default: "Shiro Documentation",
    template: "%s | Shiro",
  },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-white text-black antialiased">
        <RootProvider search={{ enabled: true }}>{children}</RootProvider>
      </body>
    </html>
  );
}
