"use client";

import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description: string;
  readonly icon?: LucideIcon;
}

export function SectionHeading({
  actions,
  children,
  description,
  icon: Icon,
}: SectionHeadingProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon === undefined ? null : (
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#ff4fd8]" />
        )}
        <h2 className="truncate text-sm font-semibold tracking-tight text-white">{children}</h2>
        <span className="group relative inline-flex">
          <button
            aria-label="Section information"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white/32 outline-none transition hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#ff4fd8]/35"
            type="button"
          >
            <Info aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <span
            className="pointer-events-none absolute left-1/2 top-7 z-20 w-64 -translate-x-1/2 rounded-xl border border-white/[.08] bg-[#0b0b0d] px-3 py-2 text-xs leading-relaxed text-white/65 opacity-0 shadow-[0_12px_36px_rgba(0,0,0,.5)] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            role="tooltip"
          >
            {description}
          </span>
        </span>
      </div>
      {actions === undefined ? null : <div className="shrink-0">{actions}</div>}
    </div>
  );
}
