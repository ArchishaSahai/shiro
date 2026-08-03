"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

interface TerminalProps {
  readonly title?: string;
  readonly children: ReactNode;
  readonly onCopy?: () => void;
  readonly copyText?: string;
  readonly actions?: ReactNode;
}

export function Terminal({
  title = "terminal",
  children,
  onCopy,
  copyText,
  actions,
}: TerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (copyText) {
      void navigator.clipboard.writeText(copyText);
    }
    if (onCopy) {
      onCopy();
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="terminal-frame overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b border-white/[.06] bg-[#0b0b0d] px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <p className="truncate font-mono text-[11px] font-medium text-white/40">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {copyText !== undefined && (
            <button
              aria-label="Copy output"
              className="terminal-action terminal-copy-action"
              onClick={handleCopy}
              type="button"
            >
              {copied ? (
                <>
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#ff4fd8]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="min-h-[200px] bg-[#0b0b0d] p-6 font-mono text-[13px] leading-relaxed text-white/80">
        {children}
      </div>
    </div>
  );
}
