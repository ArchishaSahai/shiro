"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface MetricCardProps {
  readonly accent?: "neutral" | "pink" | "green" | "amber" | "red";
  readonly icon: LucideIcon;
  readonly label: string;
  readonly numericValue?: number | undefined;
  readonly suffix?: string;
  readonly trend: string;
  readonly value: string;
}

export function MetricCard({
  accent = "neutral",
  icon: Icon,
  label,
  numericValue,
  suffix = "",
  trend,
  value,
}: MetricCardProps) {
  const displayValue = useAnimatedValue(numericValue, value, suffix);

  return (
    <motion.div
      className="group rounded-2xl border border-white/[.08] bg-[#0e0e11] p-4 shadow-[0_8px_24px_rgba(0,0,0,.4)] outline-none transition duration-200 hover:border-[#ff4fd8]/25 hover:shadow-[0_12px_36px_rgba(0,0,0,.5),0_0_28px_rgba(255,79,216,.22)]"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentClass(accent)}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <span className="rounded-full border border-white/[.08] bg-white/[.04] px-2 py-0.5 text-xs text-white/46">
          {trend}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{displayValue}</p>
    </motion.div>
  );
}

function useAnimatedValue(value: number | undefined, fallback: string, suffix: string): string {
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 24, stiffness: 120 });
  const [displayValue, setDisplayValue] = useState(fallback);

  useEffect(() => {
    if (value === undefined || reducedMotion === true) {
      setDisplayValue(fallback);
      return;
    }

    const unsubscribe = springValue.on("change", (latest) => {
      setDisplayValue(`${Math.round(latest).toLocaleString()}${suffix}`);
    });

    motionValue.set(value);
    return unsubscribe;
  }, [fallback, motionValue, reducedMotion, springValue, suffix, value]);

  return displayValue;
}

function accentClass(accent: MetricCardProps["accent"]): string {
  const classes = {
    amber: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    green: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    neutral: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    pink: "bg-[#ff4fd8]/10 text-[#ff4fd8] ring-1 ring-[#ff4fd8]/20",
    red: "bg-red-500/10 text-red-300 ring-1 ring-red-400/20",
  };

  return classes[accent ?? "neutral"];
}
