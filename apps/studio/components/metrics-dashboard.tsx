"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardTitle>Metrics Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <Metric label="Tokens" value={String(totalTokens(trace) ?? "-")} />
          <Metric
            label="Cost"
            value={
              trace.tokenUsage?.estimatedCost === undefined
                ? "-"
                : `$${String(trace.tokenUsage.estimatedCost)}`
            }
          />
          <Metric label="Latency" value={formatDuration(trace.totalDurationMs)} />
          <Metric label="Handoffs" value={String(trace.handoffs.length)} />
        </div>
        <div className="h-56">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="#e4e4e7" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#050505" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
