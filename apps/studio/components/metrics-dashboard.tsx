"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge, GitBranch, KeyRound, Layers3, Timer, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  formatDuration,
  providerLatency,
  toolLatency,
  totalTokens,
  type StudioRunTrace,
} from "@/lib/trace-utils";

export function MetricsDashboard({ trace }: { readonly trace: StudioRunTrace }) {
  const data = [
    { name: "Provider", value: providerLatency(trace) },
    { name: "Tools", value: toolLatency(trace) },
    { name: "Total", value: trace.totalDurationMs ?? 0 },
  ];

  const tokenCount = totalTokens(trace);

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          description="Tracks latency, tokens, cost, and orchestration volume for the selected run."
          icon={Gauge}
        >
          Metrics Dashboard
        </SectionHeading>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricCard
            icon={Layers3}
            label="Tokens"
            numericValue={tokenCount}
            trend="usage"
            value={tokenCount === undefined ? "—" : String(tokenCount)}
          />
          <MetricCard
            icon={Gauge}
            label="Cost"
            trend="estimate"
            value={(() => {
              const cost =
                trace.tokenUsage?.estimatedCost ??
                trace.modelCalls.reduce(
                  (sum, call) => sum + (call.tokenUsage?.estimatedCost ?? 0),
                  0
                );
              return cost === 0 ? "—" : `$${cost.toFixed(5)}`;
            })()}
          />
          <MetricCard
            icon={Timer}
            label="Latency"
            trend="total"
            value={formatDuration(trace.totalDurationMs)}
          />
          <MetricCard
            icon={KeyRound}
            label="Provider"
            trend={`${String(trace.modelCalls.length)} calls`}
            value={formatDuration(providerLatency(trace))}
          />
          <MetricCard
            icon={Workflow}
            label="Tools"
            trend={`${String(trace.toolExecutions.length)} calls`}
            value={formatDuration(toolLatency(trace))}
          />
          <MetricCard
            icon={GitBranch}
            label="Handoffs"
            numericValue={trace.handoffs.length}
            trend="agents"
            value={String(trace.handoffs.length)}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="h-72 rounded-2xl border border-white/[.08] bg-[#0e0e11]/30 p-4">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data}>
                <CartesianGrid
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 6"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  className="font-mono"
                  dataKey="name"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  className="font-mono"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={false}
                  itemStyle={{ color: "#ffffff" }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", fontFamily: "IBM Plex Mono, monospace" }}
                />
                <Bar
                  activeBar={{
                    fill: "#ff4fd8",
                    style: { filter: "drop-shadow(0 0 12px rgba(255, 79, 216, 0.45))" },
                  }}
                  dataKey="value"
                  fill="#ffffff"
                  maxBarSize={48}
                  name="Duration ms"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 rounded-2xl border border-white/[.08] bg-[#0e0e11]/30 p-4">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart
                data={trace.modelCalls.map((call, index) => ({
                  name: `Call ${String(index + 1)}`,
                  value: call.latencyMs ?? 0,
                }))}
              >
                <CartesianGrid
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 6"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  className="font-mono"
                  dataKey="name"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  className="font-mono"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  width={42}
                />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#ffffff" }} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", fontFamily: "IBM Plex Mono, monospace" }}
                />
                <Line
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  dataKey="value"
                  dot={{ fill: "#ff4fd8", r: 3 }}
                  name="Provider ms"
                  stroke="#ff4fd8"
                  strokeWidth={1.8}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "#09090b",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 12,
  boxShadow: "0 16px 42px rgba(0, 0, 0, 0.5)",
  color: "#ffffff",
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: "12px",
};
