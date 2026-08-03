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
    <html className="dark" lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[#050506] text-white antialiased">
        <RootProvider search={{ enabled: true }}>{children}</RootProvider>
      </body>
    </html>
  );
}
