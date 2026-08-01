import type { ReactNode } from "react";

interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: "default" | "success" | "danger";
}

export function Badge({ children, tone = "default" }: BadgeProps) {
  const styles = {
    danger: "border-red-300 bg-red-50 text-red-700",
    default: "border-zinc-300 bg-zinc-50 text-zinc-700",
    success: "border-emerald-300 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}
