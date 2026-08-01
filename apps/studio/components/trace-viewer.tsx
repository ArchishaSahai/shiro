"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stringifyJson, type StudioRunTrace } from "@/lib/trace-utils";

export function TraceViewer({ trace }: { readonly trace: StudioRunTrace }) {
  const json = stringifyJson(trace);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trace Viewer</CardTitle>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              void writeClipboard(json);
            }}
          >
            Copy JSON
          </Button>
          <Button
            onClick={() => {
              console.log(trace);
            }}
          >
            Console export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="max-h-96 overflow-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-white">
          {json}
        </pre>
      </CardContent>
    </Card>
  );
}

function writeClipboard(value: string): Promise<void> | undefined {
  const navigatorWithClipboard = globalThis.navigator as Navigator & {
    readonly clipboard?: {
      writeText(text: string): Promise<void>;
    };
  };

  return navigatorWithClipboard.clipboard?.writeText(value);
}
