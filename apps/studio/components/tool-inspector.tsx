"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, stringifyJson, type StudioRunTrace } from "@/lib/trace-utils";

export function ToolInspector({
  selectedTool,
  trace,
}: {
  readonly selectedTool: string | null;
  readonly trace: StudioRunTrace;
}) {
  const tool =
    trace.toolExecutions.find((entry) => entry.toolName === selectedTool) ??
    trace.toolExecutions[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Inspector</CardTitle>
      </CardHeader>
      <CardContent>
        {tool === undefined ? (
          <p className="text-sm text-zinc-500">No tool execution in this trace.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-zinc-500">Tool</p>
                <p className="font-medium">{tool.toolName}</p>
              </div>
              <Badge tone={tool.status === "completed" ? "success" : "danger"}>{tool.status}</Badge>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Panel title="Arguments" value={stringifyJson(tool.arguments ?? {})} />
              <Panel title="Result" value={stringifyJson(tool.serializedResult ?? null)} />
            </div>
            <p className="text-xs text-zinc-500">Duration: {formatDuration(tool.durationMs)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ title, value }: { readonly title: string; readonly value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase text-zinc-500">{title}</p>
      <pre className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
        {value}
      </pre>
    </div>
  );
}
