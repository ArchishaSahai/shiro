import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: "primary" | "secondary";
}

export function Button({ children, className = "", variant = "secondary", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "border-black bg-black text-white hover:bg-zinc-800"
      : "border-zinc-300 bg-white text-black hover:border-black";

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
