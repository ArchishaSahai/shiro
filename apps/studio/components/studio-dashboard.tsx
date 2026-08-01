"use client";

import { useState } from "react";
import { ApprovalCenter } from "@/components/approval-center";
import { ExecutionGraph } from "@/components/execution-graph";
import { LiveTimeline } from "@/components/live-timeline";
import { MemorySessionExplorer } from "@/components/memory-session";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { RunExplorer } from "@/components/run-explorer";
import { ToolInspector } from "@/components/tool-inspector";
import { TraceViewer } from "@/components/trace-viewer";
import { Button } from "@/components/ui/button";
import { useTraceWorkspace } from "@/hooks/use-trace-workspace";

export function StudioDashboard() {
  const { error, loadFile, selectedRunId, selectedTrace, setSelectedRunId, snapshot } =
    useTraceWorkspace();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-100 text-black">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Shiro Studio
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Execution observability</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-black transition hover:border-black">
              Load trace JSON
              <input
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const input = event.currentTarget as unknown as {
                    readonly files?: readonly File[] | null;
                  };
                  const file = input.files?.[0];
                  if (file !== undefined) {
                    void loadFile(file);
                  }
                }}
                type="file"
              />
            </label>
            <Button
              onClick={() => {
                console.log(snapshot);
              }}
              variant="primary"
            >
              Console export
            </Button>
          </div>
        </div>
        {error === null ? null : (
          <div className="mx-auto max-w-7xl px-4 pb-4 text-sm text-red-700">{error}</div>
        )}
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 xl:grid-cols-[360px_1fr]">
        <RunExplorer
          onSelectRun={setSelectedRunId}
          selectedRunId={selectedRunId}
          snapshot={snapshot}
        />
        <div className="grid gap-4">
          <MetricsDashboard trace={selectedTrace} />
          <div className="grid gap-4 lg:grid-cols-2">
            <LiveTimeline trace={selectedTrace} />
            <ExecutionGraph onSelectTool={setSelectedTool} trace={selectedTrace} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ToolInspector selectedTool={selectedTool} trace={selectedTrace} />
            <ApprovalCenter trace={selectedTrace} />
          </div>
          <MemorySessionExplorer trace={selectedTrace} />
          <TraceViewer trace={selectedTrace} />
        </div>
      </div>
    </main>
  );
}
