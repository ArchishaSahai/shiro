import type { ReactNode } from "react";

interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: "default" | "success" | "danger" | "warning";
}

export function Badge({ children, tone = "default" }: BadgeProps) {
  const styles = {
    danger: "border-red-400/30 bg-red-500/10 text-red-200",
    default: "border-white/[.08] bg-white/[.05] text-white/72",
    success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}
