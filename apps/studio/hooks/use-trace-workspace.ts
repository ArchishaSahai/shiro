"use client";

import { useMemo, useState } from "react";
import { sampleTrace } from "@/lib/sample-trace";
import {
  parseTraceSnapshot,
  type StudioRunTrace,
  type StudioTraceSnapshot,
} from "@/lib/trace-utils";

function getSampleTrace(): StudioRunTrace {
  const [trace] = sampleTrace.traces;

  if (trace === undefined) {
    throw new Error("Studio sample trace is empty.");
  }

  return trace;
}

export function useTraceWorkspace() {
  const [snapshot, setSnapshot] = useState<StudioTraceSnapshot>(sampleTrace);
  const [selectedRunId, setSelectedRunId] = useState<string>(sampleTrace.traces[0]?.runId ?? "");
  const [error, setError] = useState<string | null>(null);

  const selectedTrace = useMemo(
    () =>
      snapshot.traces.find((trace) => trace.runId === selectedRunId) ??
      snapshot.traces[0] ??
      getSampleTrace(),
    [selectedRunId, snapshot]
  );

  async function loadFile(file: File): Promise<void> {
    const text = await file.text();

    try {
      const parsed = parseTraceSnapshot(JSON.parse(text) as unknown);

      if (parsed === null) {
        setError("The selected file is not a Shiro trace export.");
        return;
      }

      setSnapshot(parsed);
      setSelectedRunId(parsed.traces[0]?.runId ?? "");
      setError(null);
    } catch {
      setError("The selected file could not be parsed as JSON.");
    }
  }

  return {
    error,
    loadFile,
    selectedRunId,
    selectedTrace,
    setSelectedRunId,
    snapshot,
  };
}
