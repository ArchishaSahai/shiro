"use client";

import { motion } from "framer-motion";
import { Database, FileClock, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import type { StudioRunTrace } from "@/lib/trace-utils";

export function MemorySessionExplorer({ trace }: { readonly trace: StudioRunTrace }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <SectionHeading
          actions={<Badge>{String(trace.memory.length)} operations</Badge>}
          description="Shows session identity, conversation volume, retrieved memory, and compaction events. Use it to inspect context continuity."
          icon={Database}
        >
          Memory & Sessions
        </SectionHeading>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <SessionStat
            icon={FileClock}
            label="Session ID"
            value={trace.sessionId ?? "No session captured"}
          />
          <SessionStat icon={Database} label="Active agent" value={trace.agentName ?? "-"} />
          <SessionStat
            icon={MessageSquareText}
            label="Messages"
            value={String(totalMessages(trace))}
          />
        </div>
        <ScrollArea className="max-h-[300px] pr-2">
          <div className="space-y-3">
            {trace.memory.length === 0 ? (
              <EmptyState
                action="Run with a session ID"
                description="Memory retrievals, stored records, and compaction events will appear here when a trace includes them."
                icon={Database}
                title="No memory operations"
              />
            ) : (
              trace.memory.map((entry, index) => (
                <motion.div
                  className="grid gap-4 rounded-2xl border border-white/[.08] bg-white/[.02] p-4 text-sm transition hover:-translate-y-0.5 hover:border-white/[.16] hover:bg-white/[.04] md:grid-cols-[minmax(0,1fr)_auto]"
                  initial={{ opacity: 0, y: 8 }}
                  key={`${entry.kind}-${String(index)}`}
                  transition={{ delay: index * 0.035, duration: 0.18 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <p className="font-semibold text-white">{entry.kind}</p>
                    <p className="mt-1 text-xs text-white/40 font-mono">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-64">
                    <InlineMetric label="Records" value={String(entry.recordCount ?? "-")} />
                    <InlineMetric label="Messages" value={String(entry.messageCount ?? "-")} />
                  </div>
                  <div className="md:col-span-2">
                    <Badge>{entry.sessionId ?? trace.sessionId ?? "session"}</Badge>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SessionStat({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Database;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[.08] bg-white/[.02] p-4">
      <Icon aria-hidden="true" className="mb-3 h-4 w-4 text-white/40" />
      <p className="text-xs uppercase tracking-wide text-white/40 font-mono">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-medium text-white" title={value}>
        {value}
      </p>
    </div>
  );
}

function InlineMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[.08] bg-white/[.02] p-2">
      <p className="text-xs uppercase text-white/40 font-mono">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function totalMessages(trace: StudioRunTrace): number {
  return trace.memory.reduce((sum, entry) => sum + (entry.messageCount ?? 0), 0);
}
