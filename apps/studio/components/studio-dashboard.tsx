"use client";

import { useState, type ChangeEvent } from "react";
import {
  Activity,
  ArrowRightLeft,
  Boxes,
  CircleAlert,
  Code2,
  Database,
  GitBranch,
  KeyRound,
  MemoryStick,
  PlayCircle,
  Search,
  Timer,
  Upload,
  Workflow,
} from "lucide-react";
import { ApprovalCenter } from "@/components/approval-center";
import { ExecutionLog } from "@/components/execution-log";
import { ExecutionGraph } from "@/components/execution-graph";
import { LiveTimeline } from "@/components/live-timeline";
import { MemorySessionExplorer } from "@/components/memory-session";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { RunExplorer } from "@/components/run-explorer";
import { ToolInspector } from "@/components/tool-inspector";
import { TraceViewer } from "@/components/trace-viewer";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { useTraceWorkspace } from "@/hooks/use-trace-workspace";
import { formatDuration, providerLatency, toolLatency, totalTokens } from "@/lib/trace-utils";
import type { LucideIcon } from "lucide-react";

const sidebarItems: readonly {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly targetId: string;
}[] = [
  { label: "Sessions", icon: Database, targetId: "memory-section" },
  { label: "Runs", icon: Activity, targetId: "runs-section" },
  { label: "Tracing", icon: GitBranch, targetId: "trace-section" },
  { label: "Execution Graph", icon: Workflow, targetId: "graph-section" },
  { label: "Memory", icon: MemoryStick, targetId: "memory-section" },
  { label: "Approvals", icon: CircleAlert, targetId: "approvals-section" },
  { label: "Providers", icon: KeyRound, targetId: "metrics-section" },
];

export function StudioDashboard() {
  const { error, loadFile, selectedRunId, selectedTrace, setSelectedRunId, snapshot } =
    useTraceWorkspace();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState("Runs");

  const handleSidebarClick = (label: string, targetId: string) => {
    setActiveItem(label);
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 hidden h-screen border-r border-white/[.08] bg-[#0b0b0d] px-4 py-5 lg:block">
          <div className="px-2">
            <p className="text-base font-semibold tracking-tight text-white">Studio</p>
            <p className="mt-1 font-mono text-[11px] text-white/36">support-agents</p>
          </div>
          <nav className="mt-8 space-y-1">
            {sidebarItems.map(({ icon: Icon, label, targetId }) => (
              <button
                className={`group flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition duration-200 hover:translate-x-0.5 hover:bg-white/[.045] hover:text-white ${
                  activeItem === label
                    ? "bg-white/[.055] text-white shadow-[inset_2px_0_0_rgba(255,79,216,.8)]"
                    : "text-white/48"
                }`}
                key={label}
                onClick={() => {
                  handleSidebarClick(label, targetId);
                }}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-white/[.08] bg-[#070707]/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Shiro Studio</p>
                <p className="mt-0.5 hidden font-mono text-[11px] text-white/38 sm:block">
                  current project / support-agents
                </p>
              </div>
              <div className="hidden h-9 min-w-72 items-center gap-2 rounded-full border border-white/[.08] bg-[#0e0e11] px-3 text-sm text-white/38 md:flex">
                <Search aria-hidden="true" className="h-4 w-4" />
                Search runs, tools, traces
                <kbd className="ml-auto rounded-full border border-white/[.08] px-1.5 py-0.5 font-mono text-[10px] text-white/48">
                  Ctrl K
                </kbd>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.045] px-3 text-sm text-white/72 transition hover:-translate-y-0.5 hover:border-white/[.12] hover:text-white"
                  href="https://github.com/shiro-ai/shiro"
                >
                  <Code2 aria-hidden="true" className="h-4 w-4" />
                  GitHub
                </a>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#ff4fd8]">
                  Trace workspace
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Execution observability
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/52">
                  Inspect traces, sessions, tools, approvals, handoffs, and model performance from
                  exported Shiro runs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/[.08] bg-white/[.045] px-3 text-sm font-medium text-white/78 transition hover:-translate-y-0.5 hover:border-white/[.12] hover:bg-white/[.07] hover:text-white">
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  Load JSON
                  <input
                    accept="application/json"
                    className="hidden"
                    onChange={(event) => {
                      handleTraceFileChange(event, loadFile);
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
                  <PlayCircle aria-hidden="true" className="mr-2 h-4 w-4" />
                  Console export
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={Activity}
                label="Runs"
                numericValue={snapshot.statistics.totalRuns}
                trend={`${String(snapshot.statistics.completedRuns)} completed`}
                value={String(snapshot.statistics.totalRuns)}
              />
              <MetricCard
                accent="pink"
                icon={Boxes}
                label="Tokens"
                numericValue={totalTokens(selectedTrace)}
                trend="current run"
                value={String(totalTokens(selectedTrace) ?? "—")}
              />
              <MetricCard
                accent="amber"
                icon={Timer}
                label="Provider latency"
                trend={`${String(selectedTrace.modelCalls.length)} calls`}
                value={formatDuration(providerLatency(selectedTrace))}
              />
              <MetricCard
                accent="green"
                icon={Workflow}
                label="Tool time"
                trend={`${String(selectedTrace.toolExecutions.length)} tools`}
                value={formatDuration(toolLatency(selectedTrace))}
              />
              <MetricCard
                accent="neutral"
                icon={ArrowRightLeft}
                label="Handoffs"
                numericValue={selectedTrace.handoffs.length}
                trend={`${String(selectedTrace.totalIterations)} iterations`}
                value={String(selectedTrace.handoffs.length)}
              />
            </div>

            {error === null ? null : (
              <div
                className="flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
                <div>
                  <p className="font-medium">Trace import failed</p>
                  <p className="mt-0.5 text-red-100/75">{error}</p>
                </div>
              </div>
            )}

            <div className="grid gap-6">
              <section
                className="scroll-mt-6 grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]"
                id="runs-section"
              >
                <RunExplorer
                  onSelectRun={setSelectedRunId}
                  selectedRunId={selectedRunId}
                  snapshot={snapshot}
                />
                <div id="metrics-section">
                  <MetricsDashboard trace={selectedTrace} />
                </div>
              </section>

              <div className="scroll-mt-6" id="log-section">
                <ExecutionLog trace={selectedTrace} />
              </div>

              <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="scroll-mt-6" id="timeline-section">
                  <LiveTimeline trace={selectedTrace} />
                </div>
                <div className="scroll-mt-6 h-full" id="graph-section">
                  <ExecutionGraph onSelectTool={setSelectedTool} trace={selectedTrace} />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="scroll-mt-6" id="tool-section">
                  <ToolInspector selectedTool={selectedTool} trace={selectedTrace} />
                </div>
                <div className="scroll-mt-6" id="approvals-section">
                  <ApprovalCenter trace={selectedTrace} />
                </div>
              </section>

              <div className="scroll-mt-6" id="memory-section">
                <MemorySessionExplorer trace={selectedTrace} />
              </div>
              <div className="scroll-mt-6" id="trace-section">
                <TraceViewer trace={selectedTrace} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function handleTraceFileChange(
  event: ChangeEvent<HTMLInputElement>,
  loadFile: (file: File) => Promise<void>
): void {
  const file = event.currentTarget.files?.item(0);

  if (file !== null && file !== undefined) {
    void loadFile(file);
  }
}
