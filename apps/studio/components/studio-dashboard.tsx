"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Timer,
  Workflow,
} from "lucide-react";
import { ApprovalCenter } from "@/components/approval-center";
import { ExecutionLog } from "@/components/execution-log";
import { ExecutionGraph } from "@/components/execution-graph";
import { LiveTimeline } from "@/components/live-timeline";
import { MemorySessionExplorer } from "@/components/memory-session";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { RunExplorer } from "@/components/run-explorer";
import { StudioTerminal } from "@/components/studio-terminal";
import { ToolInspector } from "@/components/tool-inspector";
import { TraceViewer } from "@/components/trace-viewer";
import { MetricCard } from "@/components/ui/metric-card";
import { RuntimeProvider, useRuntime } from "@/hooks/use-runtime";
import {
  formatDuration,
  providerLatency,
  toolLatency,
  totalTokens,
  type StudioRunTrace,
  type StudioTraceSnapshot,
} from "@/lib/trace-utils";
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

const EMPTY_TRACE: StudioRunTrace = Object.freeze({
  approvals: [],
  finalStatus: "running",
  handoffs: [],
  memory: [],
  modelCalls: [],
  runId: "waiting",
  startTime: new Date(0),
  timeline: { events: [], spans: [] },
  toolExecutions: [],
  totalIterations: 0,
});

export function StudioDashboard() {
  return (
    <RuntimeProvider>
      <StudioDashboardInner />
    </RuntimeProvider>
  );
}

function StudioDashboardInner() {
  const { agentsConnected, error, live, mode, selectTool, status } = useRuntime();
  const [activeItem, setActiveItem] = useState("Runs");
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedTrace = live.trace ?? EMPTY_TRACE;
  const selectedTool = live.selectedTool;

  const snapshot = useMemo<StudioTraceSnapshot>(
    () => createSnapshot(selectedTrace, status),
    [selectedTrace, status]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleSidebarClick = (label: string, targetId: string) => {
    setActiveItem(label);
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setActiveItem("Runs");
  };

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 hidden h-screen border-r border-white/[.08] bg-[#0b0b0d] px-4 py-5 lg:block">
          <div className="px-2">
            <p className="text-base font-semibold tracking-tight text-white">Studio</p>
            <p className="mt-1 font-mono text-[11px] text-white/36">
              {mode === "live" ? "live runtime" : "demo runtime"}
            </p>
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
                  {selectedTrace.agentName ?? "awaiting agent"} / {selectedTrace.runId}
                </p>
              </div>
              <label className="relative h-9 min-w-0 flex-1 max-w-md">
                <span className="sr-only">Search runs, tools, traces</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38"
                />
                <input
                  ref={searchRef}
                  autoComplete="off"
                  className="h-9 w-full rounded-full border border-white/[.08] bg-[#0e0e11] py-0 pl-9 pr-14 text-sm text-white outline-none transition placeholder:text-white/38 focus:border-[#ff4fd8]/45 focus:ring-2 focus:ring-[#ff4fd8]/10"
                  onChange={(event) => {
                    handleSearchChange(event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const target = resolveSearchTarget(searchQuery, selectedTrace);
                    setActiveItem(
                      target === "tool-section"
                        ? "Providers"
                        : target === "trace-section"
                          ? "Tracing"
                          : target === "memory-section"
                            ? "Memory"
                            : target === "approvals-section"
                              ? "Approvals"
                              : "Runs"
                    );
                    document.getElementById(target)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  placeholder="Search runs, tools, traces"
                  spellCheck={false}
                  type="search"
                  value={searchQuery}
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/[.08] px-1.5 py-0.5 font-mono text-[10px] text-white/48">
                  Ctrl K
                </kbd>
              </label>
              <div className="flex items-center gap-2">
                <ModeBadge agents={agentsConnected} mode={mode} />
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.045] px-3 text-sm text-white/72 transition hover:-translate-y-0.5 hover:border-white/[.12] hover:text-white"
                  href="https://github.com/ArchishaSahai/shiro"
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
                  Runtime debugger
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Execution observability
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/52">
                  Type prompts in the terminal. Live Mode streams SDK events; Demo Mode replays
                  built-in traces when no agent is connected.
                </p>
              </div>
            </div>

            <section className="scroll-mt-6" id="terminal-section">
              <StudioTerminal />
            </section>

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
                  <p className="font-medium">Runtime error</p>
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
                  onQueryChange={handleSearchChange}
                  onSelectRun={() => undefined}
                  query={searchQuery}
                  selectedRunId={selectedTrace.runId}
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
                  <ExecutionGraph
                    activeNodeIds={live.activeNodeIds}
                    onSelectTool={selectTool}
                    trace={selectedTrace}
                  />
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

function ModeBadge({ agents, mode }: { readonly agents: number; readonly mode: "demo" | "live" }) {
  const live = mode === "live";
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-mono text-[11px] font-medium ${
        live
          ? "border-[#ff4fd8]/35 bg-[#ff4fd8]/10 text-[#ff4fd8]"
          : "border-white/[.08] bg-white/[.045] text-white/55"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#ff4fd8] shadow-[0_0_8px_rgba(255,79,216,.8)]" : "bg-white/35"}`}
      />
      {live ? `Live Mode · ${String(agents)}` : "Demo Mode"}
    </span>
  );
}

function resolveSearchTarget(query: string, trace: StudioRunTrace): string {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return "runs-section";
  }

  if (
    normalized.includes("tool") ||
    trace.toolExecutions.some((tool) => tool.toolName.toLowerCase().includes(normalized))
  ) {
    return "tool-section";
  }

  if (normalized.includes("trace") || normalized.includes("span") || normalized.includes("event")) {
    return "trace-section";
  }

  if (normalized.includes("memory") || normalized.includes("session")) {
    return "memory-section";
  }

  if (normalized.includes("approval")) {
    return "approvals-section";
  }

  if (normalized.includes("graph")) {
    return "graph-section";
  }

  if (normalized.includes("log") || normalized.includes("terminal")) {
    return "log-section";
  }

  return "runs-section";
}

function createSnapshot(trace: StudioRunTrace, status: string): StudioTraceSnapshot {
  const completed = status === "completed" || trace.finalStatus === "completed" ? 1 : 0;
  const failed = status === "failed" || trace.finalStatus === "failed" ? 1 : 0;
  return {
    createdAt: trace.startTime,
    statistics: {
      ...(trace.totalDurationMs === undefined ? {} : { averageDurationMs: trace.totalDurationMs }),
      completedRuns: completed,
      failedRuns: failed,
      totalApprovals: trace.approvals.length,
      totalHandoffs: trace.handoffs.length,
      totalProviderCalls: trace.modelCalls.length,
      totalRuns: trace.runId === "waiting" ? 0 : 1,
      totalToolExecutions: trace.toolExecutions.length,
    },
    traces: trace.runId === "waiting" ? [] : [trace],
  };
}
