"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCommand({ command }: { readonly command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/[.10] bg-white/[.045] px-4 py-3 shadow-[0_12px_35px_rgba(0,0,0,.28)]">
      <code className="min-w-0 truncate font-mono text-sm text-[#F5F7FA]">{command}</code>
      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-live="polite"
          className={`text-xs transition ${copied ? "text-[#ff2bd6]" : "text-transparent"}`}
        >
          copied
        </span>
        <button
          aria-label="Copy installation command"
          className="shiro-icon-button"
          onClick={() => {
            void copyText(command);
            setCopied(true);
            window.setTimeout(() => {
              setCopied(false);
            }, 1400);
          }}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4 text-[#ff2bd6]" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !("clipboard" in navigator)) {
    return;
  }

  await navigator.clipboard.writeText(text).catch(() => undefined);
}
