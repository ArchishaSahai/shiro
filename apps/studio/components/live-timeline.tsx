"use client";

import { motion } from "framer-motion";
import {
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatDuration, type StudioRunTrace } from "@/lib/trace-utils";

export function LiveTimeline({ trace }: { readonly trace: StudioRunTrace }) {
  const items = trace.timeline.spans;

  return (
    <Card className="min-h-[420px]">
      <CardHeader>
        <SectionHeading
          actions={<span className="text-xs text-white/45">{String(items.length)} spans</span>}
          description="Ordered execution lifecycle with timestamps and durations."
          icon={Clock3}
        >
          Live Timeline
        </SectionHeading>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            action="Load a trace JSON"
            description="Timeline spans appear for provider calls, tools, approvals, memory, and handoffs."
            icon={Clock3}
            title="No timeline spans"
          />
        ) : (
          <ScrollArea className="max-h-[480px] pr-2">
            <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-white/[.06]">
              {items.map((span, index) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="relative z-10 grid grid-cols-[36px_1fr] gap-3"
                  initial={{ opacity: 0, x: -8 }}
                  key={span.spanId}
                  transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.18 }}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[#070707] ${dotColor(span.category, span.status)}`}
                    >
                      <TimelineIcon category={span.category} />
                    </span>
                  </div>
                  <div>
                    <details className="group rounded-xl border border-white/[.08] bg-white/[.015] p-3 transition duration-150 hover:border-white/[.16] hover:bg-white/[.03]">
                      <summary className="cursor-pointer list-none outline-none">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white/95">
                              {span.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-white/40">
                              {span.startTime.toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge>{span.category}</Badge>
                            <p className="rounded-full border border-white/[.06] bg-white/[.04] px-2 py-0.5 font-mono text-[10px] text-white/60">
                              {span.status === "running" || span.status === "pending"
                                ? "live"
                                : formatDuration(span.durationMs)}
                            </p>
                          </div>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-1 rounded-lg border border-white/[.06] bg-black/40 p-2.5 font-mono text-[11px] text-white/60">
                        <div>
                          <span className="text-white/30">status:</span> {span.status}
                        </div>
                        <div>
                          <span className="text-white/30">span_id:</span> {span.spanId}
                        </div>
                      </div>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[.04]">
                        <motion.div
                          animate={{
                            width:
                              span.status === "running" || span.status === "pending"
                                ? "64%"
                                : `${String(Math.min(100, Math.max(8, (span.durationMs ?? 0) / 12)))}%`,
                          }}
                          className="h-full rounded-full bg-[#ff4fd8]"
                          initial={{ width: "8%" }}
                          transition={{ duration: 0.35 }}
                        />
                      </div>
                    </details>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function dotColor(category: string, status: string): string {
  if (status === "running" || status === "pending") {
    return "bg-[#ff4fd8]/15 text-[#ff4fd8] ring-1 ring-[#ff4fd8]/30";
  }
  if (category.includes("tool") || category.includes("approval")) {
    return "bg-[#ff4fd8]/10 text-[#ff4fd8] ring-1 ring-[#ff4fd8]/20";
  }
  return "bg-white/[.06] text-white/80 ring-1 ring-white/[.10]";
}

function TimelineIcon({ category }: { readonly category: string }) {
  if (category.includes("provider")) {
    return <KeyRound aria-hidden="true" className="h-4 w-4" />;
  }
  if (category.includes("tool")) {
    return <Boxes aria-hidden="true" className="h-4 w-4" />;
  }
  if (category.includes("approval")) {
    return <ShieldCheck aria-hidden="true" className="h-4 w-4" />;
  }
  if (category.includes("memory")) {
    return <Database aria-hidden="true" className="h-4 w-4" />;
  }
  if (category.includes("handoff")) {
    return <GitBranch aria-hidden="true" className="h-4 w-4" />;
  }
  return <CheckCircle2 aria-hidden="true" className="h-4 w-4" />;
}
