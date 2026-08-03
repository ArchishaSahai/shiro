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

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          description="Tracks latency, tokens, cost, and orchestration volume for the selected run. Use it to spot slow stages and expensive calls."
          icon={Gauge}
        >
          Metrics Dashboard
        </SectionHeading>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            accent="blue"
            icon={Layers3}
            label="Tokens"
            numericValue={totalTokens(trace)}
            trend="usage"
            value={String(totalTokens(trace) ?? "-")}
          />
          <MetricCard
            accent="green"
            icon={Gauge}
            label="Cost"
            trend="estimate"
            value={
              trace.tokenUsage?.estimatedCost === undefined
                ? "-"
                : `$${String(trace.tokenUsage.estimatedCost)}`
            }
          />
          <MetricCard
            accent="amber"
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
            accent="green"
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
                  dataKey="name"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  className="font-mono"
                />
                <YAxis
                  axisLine={false}
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  width={42}
                  className="font-mono"
                />
                <Tooltip
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    color: "#ffffff",
                    boxShadow: "0 16px 42px rgba(0, 0, 0, 0.5)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}
                />
                <Bar
                  dataKey="value"
                  fill="#ffffff"
                  name="Duration ms"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
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
                  dataKey="name"
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  className="font-mono"
                />
                <YAxis
                  axisLine={false}
                  fontSize={10}
                  stroke="rgba(255, 255, 255, 0.4)"
                  tickLine={false}
                  width={42}
                  className="font-mono"
                />
                <Tooltip
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    color: "#ffffff",
                    boxShadow: "0 16px 42px rgba(0, 0, 0, 0.5)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 500 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}
                />
                <Line
                  dataKey="value"
                  dot={{ fill: "#ff4fd8", r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
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
