import type { ReactNode } from "react";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`border-b border-zinc-200 px-4 py-3 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: CardProps) {
  return <h2 className={`text-sm font-semibold text-black ${className}`}>{children}</h2>;
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
