import type { MockTraceDefinition } from "@/lib/runtime-events";
import { customerSupportTrace } from "@/lib/traces/customer-support";
import { multiAgentTrace } from "@/lib/traces/multi-agent";
import { refundTrace } from "@/lib/traces/refund";
import { researchTrace } from "@/lib/traces/research";
import { travelAgentTrace } from "@/lib/traces/travel-agent";

export const mockTraces: readonly MockTraceDefinition[] = [
  customerSupportTrace,
  refundTrace,
  travelAgentTrace,
  researchTrace,
  multiAgentTrace,
];

/** Replayable mock traces. JSON mirrors live under `lib/traces/json/*.json`. */

export function listMockTraces(): readonly MockTraceDefinition[] {
  return mockTraces;
}

export function findTraceByCommand(input: string): MockTraceDefinition | null {
  const normalized = normalizeCommand(input);
  if (normalized.length === 0) {
    return null;
  }

  for (const trace of mockTraces) {
    const candidates = [
      trace.id,
      trace.command,
      ...trace.aliases,
      `shiro run ${trace.id}`,
      `shiro run ${trace.aliases[0] ?? trace.id}`,
      `shiro replay ${trace.id}`,
      `shiro replay traces/${trace.id}`,
    ].map(normalizeCommand);

    if (candidates.includes(normalized)) {
      return trace;
    }

    if (normalized.startsWith("shiro run ") || normalized.startsWith("shiro replay ")) {
      const target = normalized.replace(/^shiro (?:run|replay)\s+/, "");
      if (
        target === trace.id ||
        trace.aliases.some((alias) => alias === target || alias.endsWith(`/${target}`))
      ) {
        return trace;
      }
    }
  }

  return null;
}

export function serializeTraceAsJson(trace: MockTraceDefinition): string {
  return JSON.stringify(trace, null, 2);
}

function normalizeCommand(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\$\s*/, "")
    .replace(/\s+/g, " ");
}
