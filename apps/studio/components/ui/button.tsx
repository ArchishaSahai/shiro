import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: "primary" | "secondary";
}

export function Button({ children, className = "", variant = "secondary", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "border-white/[.12] bg-white/[.10] text-white hover:border-[#ff4fd8]/35 hover:bg-white/[.13]"
      : "border-white/[.08] bg-white/[.045] text-white/78 hover:border-white/[.14] hover:bg-white/[.07] hover:text-white";

  return (
    <button
      className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
