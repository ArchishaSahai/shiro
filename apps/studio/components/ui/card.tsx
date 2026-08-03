import type { ReactNode } from "react";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-white/[.08] bg-[#0e0e11] shadow-[0_12px_36px_rgba(0,0,0,.5)] transition duration-200 hover:border-white/[.12] hover:shadow-[0_16px_48px_rgba(0,0,0,.6),0_0_24px_rgba(255,79,216,.02)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`border-b border-white/[.08] px-5 py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: CardProps) {
  return (
    <h2 className={`text-sm font-semibold tracking-tight text-white ${className}`}>{children}</h2>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
