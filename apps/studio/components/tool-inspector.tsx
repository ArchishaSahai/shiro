"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clipboard, Code2, Timer, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal } from "@/components/ui/terminal";
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
    <Card className="min-h-[460px]">
      <CardHeader>
        <SectionHeading
          actions={
            <span className="font-mono text-xs text-white/40">
              {String(trace.toolExecutions.length)} calls
            </span>
          }
          description="Inspect tool input, output, status, and execution time."
          icon={Wrench}
        >
          Tool Inspector
        </SectionHeading>
      </CardHeader>
      <CardContent>
        {tool === undefined ? (
          <EmptyState
            action="Select a trace with tool calls"
            description="Tool arguments, outputs, status, and timings appear here."
            icon={Wrench}
            title="No tool execution"
          />
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            initial={{ opacity: 0, y: 8 }}
            key={tool.toolName + tool.status}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[.06] text-white">
                  <Wrench aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase text-white/40">Tool</p>
                  <p className="truncate font-semibold text-white">{tool.toolName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    tool.status === "completed"
                      ? "success"
                      : tool.status === "running"
                        ? "warning"
                        : "danger"
                  }
                >
                  {tool.status}
                </Badge>
                <Badge>{formatDuration(tool.durationMs)}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat icon={Timer} label="Duration" value={formatDuration(tool.durationMs)} />
              <Stat icon={CheckCircle2} label="Selected" value={selectedTool ?? tool.toolName} />
            </div>
            <Tabs defaultValue="arguments">
              <TabsList className="mb-3">
                <TabsTrigger icon={Code2} value="arguments">
                  Arguments
                </TabsTrigger>
                <TabsTrigger icon={Clipboard} value="result">
                  Result
                </TabsTrigger>
              </TabsList>
              <TabsContent value="arguments">
                <JsonPanel title="Arguments" value={stringifyJson(tool.arguments ?? {})} />
              </TabsContent>
              <TabsContent value="result">
                <JsonPanel title="Result" value={stringifyJson(tool.serializedResult ?? null)} />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Timer;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[.08] bg-white/[.02] p-3">
      <Icon aria-hidden="true" className="mb-3 h-4 w-4 text-white/40" />
      <p className="font-mono text-xs uppercase text-white/40">{label}</p>
      <p className="mt-1 truncate font-semibold text-white">{value}</p>
    </div>
  );
}

function JsonPanel({ title, value }: { readonly title: string; readonly value: string }) {
  return (
    <Terminal copyText={value} title={title.toLowerCase()}>
      <ScrollArea className="max-h-72">
        <pre className="text-xs leading-relaxed text-white/90">
          <code>{value}</code>
        </pre>
      </ScrollArea>
    </Terminal>
  );
}
