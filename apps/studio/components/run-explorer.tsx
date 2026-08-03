"use client";

import { motion } from "framer-motion";
import { Activity, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  formatDuration,
  statusTone,
  type StudioRunTrace,
  type StudioTraceSnapshot,
  type StudioTraceStatus,
} from "@/lib/trace-utils";

interface RunExplorerProps {
  readonly snapshot: StudioTraceSnapshot;
  readonly selectedRunId: string;
  readonly onSelectRun: (runId: string) => void;
}

type RunFilter = "all" | StudioTraceStatus;
type RunSort = "newest" | "duration";

export function RunExplorer({ onSelectRun, selectedRunId, snapshot }: RunExplorerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RunFilter>("all");
  const [sort, setSort] = useState<RunSort>("newest");
  const runs = useMemo(
    () => filterRuns(snapshot.traces, query, filter, sort),
    [filter, query, snapshot.traces, sort]
  );

  return (
    <Card className="min-h-[620px]">
      <CardHeader>
        <SectionHeading
          actions={<Badge>{String(runs.length)} shown</Badge>}
          description="Lists captured Shiro runs with status, agent, provider, model, cost, and latency. Use it to jump between executions."
          icon={Activity}
        >
          Run Explorer
        </SectionHeading>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          />
          <input
            aria-label="Search runs"
            className="h-10 w-full rounded-xl border border-white/[.08] bg-black/30 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#ff4fd8]/45 focus:ring-2 focus:ring-[#ff4fd8]/10"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            placeholder="Search agent, run, provider..."
            value={query}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            aria-label="Filter runs"
            className="h-9 rounded-xl border border-white/[.08] bg-black/30 px-3 text-sm text-white outline-none focus:border-[#ff4fd8]/45"
            onChange={(event) => {
              setFilter(event.currentTarget.value as RunFilter);
            }}
            value={filter}
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
          </select>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[.08] bg-black/30 px-3 text-sm text-white/72 transition hover:-translate-y-0.5 hover:border-white/[.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4fd8]/35"
            onClick={() => {
              setSort((value) => (value === "newest" ? "duration" : "newest"));
            }}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            {sort === "newest" ? "Newest" : "Duration"}
          </button>
        </div>
        <ScrollArea className="max-h-[calc(100vh-310px)] pr-1">
          {runs.length === 0 ? (
            <EmptyState
              description="No runs match the current search or filter. Clear the query to return to the full trace set."
              icon={Activity}
              title="No matching runs"
            />
          ) : (
            <div className="border border-white/[.08] rounded-xl overflow-hidden bg-black/10 divide-y divide-white/[.06]">
              {runs.map((trace, index) => (
                <RunCard
                  index={index}
                  key={trace.runId}
                  onSelectRun={onSelectRun}
                  selected={trace.runId === selectedRunId}
                  trace={trace}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RunCard({
  index,
  onSelectRun,
  selected,
  trace,
}: {
  readonly index: number;
  readonly onSelectRun: (runId: string) => void;
  readonly selected: boolean;
  readonly trace: StudioRunTrace;
}) {
  return (
    <motion.button
      className={`w-full relative py-2.5 px-3.5 text-left outline-none transition duration-150 flex items-center justify-between gap-4 cursor-pointer select-none ${
        selected
          ? "bg-white/[.04] text-white"
          : "text-white/70 hover:bg-white/[.015] hover:text-white"
      }`}
      initial={{ opacity: 0 }}
      onClick={() => {
        onSelectRun(trace.runId);
      }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.015, 0.2), duration: 0.15 }}
      type="button"
    >
      {selected && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff4fd8]"
          layoutId="activeRunIndicator"
          transition={{ type: "spring", stiffness: 350, damping: 35 }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-white/90 truncate">
            {trace.agentName ?? "Agent"}
          </span>
          <span className="font-mono text-[10px] text-white/40 truncate">
            {trace.runId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
          <span className="flex items-center gap-1 font-mono">{trace.provider ?? "-"}</span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span>{formatDuration(trace.totalDurationMs)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge tone={statusTone(trace.finalStatus)}>{trace.finalStatus}</Badge>
      </div>
    </motion.button>
  );
}

function filterRuns(
  traces: readonly StudioRunTrace[],
  query: string,
  filter: RunFilter,
  sort: RunSort
): readonly StudioRunTrace[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = traces.filter((trace) => {
    const matchesFilter = filter === "all" || trace.finalStatus === filter;
    const searchable = `${trace.runId} ${trace.agentName ?? ""} ${trace.provider ?? ""} ${
      trace.model ?? ""
    }`.toLowerCase();

    return matchesFilter && searchable.includes(normalizedQuery);
  });

  return [...filtered].sort((left, right) => {
    if (sort === "duration") {
      return (right.totalDurationMs ?? 0) - (left.totalDurationMs ?? 0);
    }

    return right.startTime.getTime() - left.startTime.getTime();
  });
}
