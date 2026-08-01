"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDuration,
  statusTone,
  totalTokens,
  type StudioRunTrace,
  type StudioTraceSnapshot,
} from "@/lib/trace-utils";

interface RunExplorerProps {
  readonly snapshot: StudioTraceSnapshot;
  readonly selectedRunId: string;
  readonly onSelectRun: (runId: string) => void;
}

export function RunExplorer({ onSelectRun, selectedRunId, snapshot }: RunExplorerProps) {
  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle>Run Explorer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {snapshot.traces.map((trace) => (
          <button
            className={`w-full rounded-md border p-3 text-left transition ${
              trace.runId === selectedRunId
                ? "border-black bg-zinc-50"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
            key={trace.runId}
            onClick={() => {
              onSelectRun(trace.runId);
            }}
            type="button"
          >
            <RunSummary trace={trace} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function RunSummary({ trace }: { readonly trace: StudioRunTrace }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-zinc-500">Run ID</p>
          <p className="break-all font-mono text-xs text-black">{trace.runId}</p>
        </div>
        <Badge tone={statusTone(trace.finalStatus)}>{trace.finalStatus}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-zinc-600">
        <Metric label="Agent" value={trace.agentName ?? "-"} />
        <Metric label="Provider" value={trace.provider ?? "-"} />
        <Metric label="Model" value={trace.model ?? trace.modelCalls[0]?.model ?? "-"} />
        <Metric label="Duration" value={formatDuration(trace.totalDurationMs)} />
        <Metric label="Tokens" value={String(totalTokens(trace) ?? "-")} />
        <Metric
          label="Cost"
          value={
            trace.tokenUsage?.estimatedCost === undefined
              ? "-"
              : `$${String(trace.tokenUsage.estimatedCost)}`
          }
        />
        <Metric label="Iterations" value={String(trace.totalIterations)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="truncate font-medium text-zinc-900">{value}</p>
    </div>
  );
}
