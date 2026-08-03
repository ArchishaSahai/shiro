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
          description="Shows the ordered execution lifecycle with timestamps and durations. Use it to understand where time was spent."
          icon={Clock3}
        >
          Live Timeline
        </SectionHeading>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            action="Load a trace JSON"
            description="Timeline spans will appear here as provider calls, tools, approvals, memory, and handoffs are recorded."
            icon={Clock3}
            title="No timeline spans"
          />
        ) : (
          <ScrollArea className="max-h-[360px] pr-2">
            <div className="space-y-4 relative before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-[1px] before:bg-white/[.06]">
              {items.map((span, index) => (
                <motion.div
                  className="grid grid-cols-[36px_1fr] gap-3 relative z-10"
                  initial={{ opacity: 0, x: -8 }}
                  key={span.spanId}
                  transition={{ delay: index * 0.025, duration: 0.18 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, x: 0 }}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[#070707] ${dotColor(span.category)}`}
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
                            <p className="mt-0.5 text-[10px] text-white/40 font-mono">
                              {span.startTime.toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge>{span.category}</Badge>
                            <p className="rounded-full bg-white/[.04] border border-white/[.06] px-2 py-0.5 text-[10px] text-white/60 font-mono">
                              {formatDuration(span.durationMs)}
                            </p>
                          </div>
                        </div>
                      </summary>
                      <div className="mt-3 rounded-lg border border-white/[.06] bg-black/40 p-2.5 text-[11px] text-white/60 font-mono space-y-1">
                        <div>
                          <span className="text-white/30">status:</span> {span.status}
                        </div>
                        <div>
                          <span className="text-white/30">span_id:</span> {span.spanId}
                        </div>
                      </div>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[.04]">
                        <div
                          className="h-full rounded-full bg-[#ff4fd8]"
                          style={{
                            width: `${String(Math.min(100, Math.max(8, span.durationMs ?? 0) / 12))}%`,
                          }}
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

function dotColor(category: string): string {
  if (category.includes("tool")) {
    return "bg-[#ff4fd8]/10 text-[#ff4fd8] ring-1 ring-[#ff4fd8]/20";
  }

  if (category.includes("approval")) {
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
