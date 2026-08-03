"use client";

import { motion } from "framer-motion";
import { ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState as EmptyPanel } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatDuration, type StudioRunTrace } from "@/lib/trace-utils";

export function ApprovalCenter({ trace }: { readonly trace: StudioRunTrace }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <SectionHeading
          actions={<Badge>{String(trace.approvals.length)} requests</Badge>}
          description="Shows human approval requests, policies, decisions, and latency. Use it to audit sensitive tool execution."
          icon={ShieldCheck}
        >
          Approval Center
        </SectionHeading>
      </CardHeader>
      <CardContent>
        {trace.approvals.length === 0 ? (
          <ApprovalEmptyState />
        ) : (
          <ScrollArea className="max-h-[300px] pr-2">
            <div className="space-y-3">
              {trace.approvals.map((approval, index) => (
                <motion.details
                  className="group rounded-2xl border border-white/[.08] bg-white/[.02] p-4 transition hover:-translate-y-0.5 hover:border-white/[.16] hover:bg-white/[.04]"
                  initial={{ opacity: 0, y: 8 }}
                  key={`${approval.toolName}-${approval.timestamp.toISOString()}`}
                  transition={{ delay: index * 0.035, duration: 0.18 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[.06] text-white">
                          <UserCheck aria-hidden="true" className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {approval.toolName}
                          </p>
                          <p className="mt-1 text-xs text-white/40 font-mono">
                            {approval.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge tone={approvalTone(approval.decision)}>
                        {approval.decision ?? "pending"}
                      </Badge>
                    </div>
                  </summary>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <Fact label="Policy" value={approval.policy ?? "-"} />
                    <Fact label="Duration" value={formatDuration(approval.durationMs)} />
                    <Fact label="Approver" value={approval.approver ?? "-"} />
                  </div>
                </motion.details>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalEmptyState() {
  return (
    <EmptyPanel
      action="Configure a sensitive tool"
      description="Sensitive tool approval events will appear here with policy, decision, approver, and duration."
      icon={ShieldCheck}
      title="No approval requests"
    />
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[.08] bg-white/[.02] p-2">
      <p className="uppercase tracking-wide text-white/40 font-mono">{label}</p>
      <p className="mt-1 truncate font-medium text-white">{value}</p>
    </div>
  );
}

function approvalTone(decision: string | undefined): "success" | "danger" | "warning" | "default" {
  if (decision?.includes("granted") === true) {
    return "success";
  }

  if (decision?.includes("rejected") === true || decision?.includes("denied") === true) {
    return "danger";
  }

  if (decision === undefined) {
    return "warning";
  }

  return "default";
}
