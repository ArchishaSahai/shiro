"use client";

import { motion } from "framer-motion";
import { ClipboardCopy, Download, Filter, Search, Table2, TerminalSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeading } from "@/components/ui/section-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal } from "@/components/ui/terminal";
import { formatDuration, stringifyJson, type StudioRunTrace } from "@/lib/trace-utils";

export function TraceViewer({ trace }: { readonly trace: StudioRunTrace }) {
  const json = stringifyJson(trace);
  const [spanQuery, setSpanQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const spans = useMemo(
    () =>
      trace.timeline.spans.filter((span) =>
        `${span.name} ${span.category} ${span.status}`
          .toLowerCase()
          .includes(spanQuery.toLowerCase())
      ),
    [spanQuery, trace.timeline.spans]
  );
  const eventTypes = [...new Set(trace.timeline.events.map((event) => event.type))];
  const events = trace.timeline.events.filter(
    (event) => eventFilter === "all" || event.type === eventFilter
  );

  return (
    <Card>
      <CardHeader>
        <SectionHeading
          actions={<Badge>{trace.finalStatus}</Badge>}
          description="Displays raw spans, emitted events, and exported JSON. Use it for audit trails, debugging, and sharing reproducible traces."
          icon={TerminalSquare}
        >
          Trace Viewer
        </SectionHeading>
        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            />
            <input
              aria-label="Search spans"
              className="h-9 w-full rounded-xl border border-white/[.08] bg-[#0e0e11]/50 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#ff4fd8]/45 focus:ring-2 focus:ring-[#ff4fd8]/10"
              onChange={(event) => {
                setSpanQuery(event.currentTarget.value);
              }}
              placeholder="Search spans..."
              value={spanQuery}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter events"
              className="h-9 rounded-xl border border-white/[.08] bg-[#0e0e11]/50 px-3 text-sm text-white outline-none focus:border-[#ff4fd8]/45"
              onChange={(event) => {
                setEventFilter(event.currentTarget.value);
              }}
              value={eventFilter}
            >
              <option value="all">All events</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                void writeClipboard(json);
              }}
            >
              <ClipboardCopy aria-hidden="true" className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              onClick={() => {
                console.log(trace);
              }}
            >
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              Console
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="spans">
          <TabsList className="mb-4">
            <TabsTrigger icon={Table2} value="spans">
              Spans
            </TabsTrigger>
            <TabsTrigger icon={Filter} value="events">
              Events
            </TabsTrigger>
            <TabsTrigger icon={TerminalSquare} value="json">
              JSON
            </TabsTrigger>
          </TabsList>
          <TabsContent value="spans">
            {spans.length === 0 ? (
              <EmptyState
                description="No spans match the current search. Try a provider, tool, memory, or approval keyword."
                icon={Search}
                title="No matching spans"
              />
            ) : (
              <ScrollArea className="max-h-[520px] rounded-2xl border border-white/[.08]">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-[#0e0e11] text-left text-xs uppercase text-white/40">
                    <tr>
                      <th className="border-b border-white/[.08] px-3 py-2">Span</th>
                      <th className="border-b border-white/[.08] px-3 py-2">Category</th>
                      <th className="border-b border-white/[.08] px-3 py-2">Status</th>
                      <th className="border-b border-white/[.08] px-3 py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spans.map((span, index) => (
                      <motion.tr
                        className="border-b border-white/[.08] transition hover:bg-white/[.03]"
                        initial={{ opacity: 0 }}
                        key={span.spanId}
                        transition={{ delay: index * 0.015, duration: 0.16 }}
                        viewport={{ once: true }}
                        whileInView={{ opacity: 1 }}
                      >
                        <td className="px-3 py-3 font-medium text-white">{span.name}</td>
                        <td className="px-3 py-3 text-white/50">{span.category}</td>
                        <td className="px-3 py-3">
                          <Badge tone={span.status === "completed" ? "success" : "default"}>
                            {span.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-white/50">
                          {formatDuration(span.durationMs)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </TabsContent>
          <TabsContent value="events">
            <ScrollArea className="max-h-[520px] rounded-2xl border border-white/[.08]">
              <div className="divide-y divide-white/[.08]">
                {events.map((event, index) => (
                  <motion.div
                    className="grid gap-1 p-3 transition hover:bg-white/[.03] sm:grid-cols-[1fr_180px]"
                    initial={{ opacity: 0, y: 6 }}
                    key={event.eventId}
                    transition={{ delay: index * 0.018, duration: 0.16 }}
                    viewport={{ once: true }}
                    whileInView={{ opacity: 1, y: 0 }}
                  >
                    <p className="font-mono text-xs font-medium text-white">{event.type}</p>
                    <p className="text-xs text-white/40">{event.timestamp.toLocaleTimeString()}</p>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="json">
            <Terminal title={`trace-${trace.runId}.json`} copyText={json}>
              <ScrollArea className="max-h-[520px]">
                <pre className="text-xs leading-relaxed text-white/80 font-mono">
                  <code>{json}</code>
                </pre>
              </ScrollArea>
            </Terminal>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function writeClipboard(value: string): Promise<void> {
  return globalThis.navigator.clipboard.writeText(value);
}
