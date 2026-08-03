"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  readonly action?: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly title: string;
}

export function EmptyState({ action, description, icon: Icon, title }: EmptyStateProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[.08] bg-black/25 p-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[.08] bg-white/[.045] text-white/80">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-white/52">{description}</p>
      {action === undefined ? null : (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#ff4fd8]/80 font-mono">
          {action}
        </p>
      )}
    </motion.div>
  );
}
