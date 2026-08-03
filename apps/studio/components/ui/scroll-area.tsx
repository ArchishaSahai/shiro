import type { ReactNode } from "react";

export function ScrollArea({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={`overflow-auto overscroll-contain ${className}`}>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
