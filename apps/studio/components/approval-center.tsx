"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, type StudioRunTrace } from "@/lib/trace-utils";

export function ApprovalCenter({ trace }: { readonly trace: StudioRunTrace }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Center</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trace.approvals.length === 0 ? (
          <p className="text-sm text-zinc-500">No approval requests in this trace.</p>
        ) : (
          trace.approvals.map((approval) => (
            <div
              className="rounded-md border border-zinc-200 p-3"
              key={`${approval.toolName}-${approval.timestamp.toISOString()}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{approval.toolName}</p>
                <Badge
                  tone={approval.decision?.includes("granted") === true ? "success" : "default"}
                >
                  {approval.decision ?? "pending"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                policy {approval.policy ?? "-"} · duration {formatDuration(approval.durationMs)} ·
                approver {approval.approver ?? "-"}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
