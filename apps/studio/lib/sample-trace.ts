import type { StudioRunTrace, StudioTraceSnapshot } from "@/lib/trace-utils";

const started = "2026-08-01T04:31:27.335Z";

export const sampleTrace: StudioTraceSnapshot = Object.freeze({
  createdAt: new Date("2026-08-01T04:31:54.000Z"),
  statistics: Object.freeze({
    averageDurationMs: 1870,
    completedRuns: 1,
    failedRuns: 0,
    totalApprovals: 1,
    totalHandoffs: 2,
    totalProviderCalls: 3,
    totalRuns: 1,
    totalToolExecutions: 1,
  }),
  traces: Object.freeze([
    Object.freeze({
      agentName: "Manager",
      approvals: Object.freeze([
        Object.freeze({
          decision: "approval.granted",
          durationMs: 180,
          policy: "sensitive-tool",
          timestamp: new Date("2026-08-01T04:31:29.000Z"),
          toolName: "deploy-check",
        }),
      ]),
      endTime: new Date("2026-08-01T04:31:29.205Z"),
      finalOutput: "Weather reviewed and security check passed.",
      finalStatus: "completed",
      handoffs: Object.freeze([
        Object.freeze({
          destinationAgent: "Research Agent",
          durationMs: 80,
          reason: "Gather weather context.",
          sourceAgent: "Manager",
          timestamp: new Date("2026-08-01T04:31:28.100Z"),
        }),
        Object.freeze({
          destinationAgent: "Security Agent",
          durationMs: 90,
          reason: "Validate deployment safety.",
          sourceAgent: "Manager",
          timestamp: new Date("2026-08-01T04:31:28.700Z"),
        }),
      ]),
      memory: Object.freeze([
        Object.freeze({
          kind: "session_loaded",
          sessionId: "session_demo",
          timestamp: new Date("2026-08-01T04:31:27.450Z"),
        }),
        Object.freeze({
          kind: "retrieved",
          recordCount: 2,
          timestamp: new Date("2026-08-01T04:31:27.520Z"),
        }),
        Object.freeze({
          kind: "compacted",
          messageCount: 6,
          timestamp: new Date("2026-08-01T04:31:28.900Z"),
        }),
        Object.freeze({
          kind: "stored",
          recordCount: 1,
          timestamp: new Date("2026-08-01T04:31:29.180Z"),
        }),
      ]),
      modelCalls: Object.freeze([
        Object.freeze({
          finishReason: "tool_calls",
          latencyMs: 420,
          model: "gpt-5",
          providerName: "openai",
          requestTimestamp: new Date("2026-08-01T04:31:27.600Z"),
          responseTimestamp: new Date("2026-08-01T04:31:28.020Z"),
          tokenUsage: Object.freeze({ inputTokens: 820, outputTokens: 120, totalTokens: 940 }),
        }),
        Object.freeze({
          finishReason: "handoff",
          latencyMs: 390,
          model: "gpt-5",
          providerName: "openai",
          requestTimestamp: new Date("2026-08-01T04:31:28.200Z"),
          responseTimestamp: new Date("2026-08-01T04:31:28.590Z"),
        }),
        Object.freeze({
          finishReason: "completed",
          latencyMs: 510,
          model: "gpt-5",
          providerName: "openai",
          requestTimestamp: new Date("2026-08-01T04:31:28.690Z"),
          responseTimestamp: new Date("2026-08-01T04:31:29.200Z"),
        }),
      ]),
      provider: "openai",
      runId: "run_demo_manager_weather_security",
      sessionId: "session_demo",
      startTime: new Date(started),
      timeline: Object.freeze({
        events: Object.freeze([
          event("run.started", started),
          event("provider.started", "2026-08-01T04:31:27.600Z"),
          event("tool.started", "2026-08-01T04:31:28.030Z"),
          event("tool.completed", "2026-08-01T04:31:28.090Z"),
          event("agent.handoff.started", "2026-08-01T04:31:28.100Z"),
          event("agent.handoff.completed", "2026-08-01T04:31:28.180Z"),
          event("approval.requested", "2026-08-01T04:31:29.000Z"),
          event("approval.granted", "2026-08-01T04:31:29.180Z"),
          event("output.validation.succeeded", "2026-08-01T04:31:29.200Z"),
          event("run.completed", "2026-08-01T04:31:29.205Z"),
        ]),
        spans: Object.freeze([
          span("Provider Call", "provider", 420, "2026-08-01T04:31:27.600Z"),
          span("Weather Tool", "tool", 60, "2026-08-01T04:31:28.030Z"),
          span("Agent Handoff", "handoff", 80, "2026-08-01T04:31:28.100Z"),
          span("Approval Request", "approval", 180, "2026-08-01T04:31:29.000Z"),
          span("Structured Output Validation", "output_validation", 5, "2026-08-01T04:31:29.200Z"),
        ]),
      }),
      toolExecutions: Object.freeze([
        Object.freeze({
          arguments: Object.freeze({ city: "Pune" }),
          durationMs: 60,
          serializedResult: Object.freeze({ city: "Pune", condition: "cloudy", temperature: 24 }),
          status: "completed",
          toolName: "weather",
        }),
      ]),
      totalDurationMs: 1870,
      totalIterations: 3,
    } satisfies StudioRunTrace),
  ]),
});

function event(type: string, timestamp: string) {
  return Object.freeze({
    eventId: `event_${type}_${timestamp}`,
    runId: "run_demo_manager_weather_security",
    timestamp: new Date(timestamp),
    type,
  });
}

function span(
  name: string,
  category: StudioRunTrace["timeline"]["spans"][number]["category"],
  durationMs: number,
  start: string
) {
  const startTime = new Date(start);
  return Object.freeze({
    category,
    durationMs,
    endTime: new Date(startTime.getTime() + durationMs),
    name,
    spanId: `span_${name.toLowerCase().replaceAll(" ", "_")}`,
    startTime,
    status: "completed",
  });
}
