"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, type StudioRunTrace } from "@/lib/trace-utils";

export function LiveTimeline({ trace }: { readonly trace: StudioRunTrace }) {
  const items = trace.timeline.spans.length > 0 ? trace.timeline.spans : [];

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle>Live Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {items.map((span, index) => (
            <div className="grid grid-cols-[24px_1fr] gap-3" key={span.spanId}>
              <div className="flex flex-col items-center">
                <span className="mt-1 h-3 w-3 rounded-full bg-black" />
                {index < items.length - 1 ? (
                  <span className="h-full min-h-10 w-px bg-zinc-200" />
                ) : null}
              </div>
              <div className="pb-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-black">{span.name}</p>
                  <p className="text-xs text-zinc-500">{formatDuration(span.durationMs)}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {span.category} · {span.startTime.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
