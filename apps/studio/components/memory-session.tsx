"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioRunTrace } from "@/lib/trace-utils";

export function MemorySessionExplorer({ trace }: { readonly trace: StudioRunTrace }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory & Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-zinc-200 p-3">
          <p className="text-xs uppercase text-zinc-500">Session</p>
          <p className="font-mono text-sm">{trace.sessionId ?? "No session captured"}</p>
        </div>
        <div className="space-y-2">
          {trace.memory.map((entry, index) => (
            <div
              className="rounded-md border border-zinc-200 p-3 text-sm"
              key={`${entry.kind}-${String(index)}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{entry.kind}</p>
                <p className="text-xs text-zinc-500">{entry.timestamp.toLocaleTimeString()}</p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                records {entry.recordCount ?? "-"} · messages {entry.messageCount ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
