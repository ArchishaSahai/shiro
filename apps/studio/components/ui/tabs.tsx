"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface TabsContextValue {
  readonly value: string;
  setValue(value: string): void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  readonly children: ReactNode;
  readonly defaultValue: string;
  readonly className?: string;
}

export function Tabs({ children, className = "", defaultValue }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  const context = useMemo(() => ({ setValue, value }), [value]);

  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-xl border border-white/[.08] bg-black/35 p-1 ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  children,
  icon: Icon,
  value,
}: {
  readonly children: ReactNode;
  readonly icon?: LucideIcon;
  readonly value: string;
}) {
  const context = useTabsContext();
  const selected = context.value === value;

  return (
    <button
      aria-selected={selected}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        selected
          ? "bg-white/[.10] text-white shadow-[0_0_18px_rgba(255,79,216,.08)]"
          : "text-white/52 hover:bg-white/[.055] hover:text-white"
      }`}
      onClick={() => {
        context.setValue(value);
      }}
      role="tab"
      type="button"
    >
      {Icon === undefined ? null : (
        <Icon aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />
      )}
      {children}
    </button>
  );
}

export function TabsContent({
  children,
  className = "",
  value,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly value: string;
}) {
  const context = useTabsContext();

  if (context.value !== value) {
    return null;
  }

  return (
    <div className={className} role="tabpanel">
      {children}
    </div>
  );
}

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);

  if (context === null) {
    throw new Error("Tabs components must be rendered inside Tabs.");
  }

  return context;
}
