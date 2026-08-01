import { describe, expect, it } from "vitest";

import { ShiroEventType, type ShiroEvent } from "../events/index.js";
import { ToolExecutionState } from "../tool/index.js";
import {
  ConsoleTraceExporter,
  JsonTraceExporter,
  TraceManager,
  TraceSpanCategory,
  TraceStatus,
} from "./tracer.js";

describe("TraceManager", () => {
  it("builds a run trace from lifecycle events", async () => {
    const manager = new TraceManager();
    const runId = "run_trace_test";
    const started = new Date("2026-08-01T00:00:00.000Z");
    const finished = new Date("2026-08-01T00:00:01.000Z");

    for (const event of traceEvents(runId, started, finished)) {
      await manager.publish(event);
    }

    const trace = await manager.get(runId);
    const snapshot = await manager.snapshot();
    const exported = await manager.export(new JsonTraceExporter());

    expect(trace?.finalStatus).toBe(TraceStatus.Completed);
    expect(trace?.provider).toBe("test-provider");
    expect(trace?.totalIterations).toBe(1);
    expect(trace?.modelCalls).toHaveLength(1);
    expect(trace?.toolExecutions).toHaveLength(1);
    expect(trace?.memory).toHaveLength(4);
    expect(trace?.handoffs).toHaveLength(1);
    expect(trace?.approvals).toHaveLength(1);
    expect(trace?.timeline.spans.some((span) => span.category === TraceSpanCategory.Provider)).toBe(
      true
    );
    expect(snapshot.statistics.totalRuns).toBe(1);
    expect(typeof exported).toBe("string");
  });

  it("supports console exporting", async () => {
    const manager = new TraceManager();
    await manager.publish({
      input: "hello",
      runId: "run_console",
      timestamp: new Date(),
      type: ShiroEventType.RunStarted,
    });
    await manager.publish({
      runId: "run_console",
      timestamp: new Date(),
      type: ShiroEventType.RunCompleted,
    });

    await expect(manager.export(new ConsoleTraceExporter())).resolves.toBeUndefined();
  });
});

function traceEvents(runId: string, started: Date, finished: Date): readonly ShiroEvent[] {
  return [
    {
      input: "hello",
      runId,
      timestamp: started,
      type: ShiroEventType.RunStarted,
    },
    {
      agentName: "Manager",
      runId,
      timestamp: started,
      type: ShiroEventType.AgentStarted,
    },
    {
      runId,
      sessionId: "session_test",
      timestamp: started,
      type: ShiroEventType.SessionLoaded,
    },
    {
      recordCount: 2,
      runId,
      timestamp: started,
      type: ShiroEventType.MemoryRetrieved,
    },
    {
      providerName: "test-provider",
      runId,
      timestamp: started,
      type: ShiroEventType.ProviderStarted,
    },
    {
      providerName: "test-provider",
      runId,
      timestamp: new Date("2026-08-01T00:00:00.100Z"),
      type: ShiroEventType.ProviderFinished,
    },
    {
      runId,
      timestamp: new Date("2026-08-01T00:00:00.200Z"),
      toolCall: {
        arguments: {
          city: "Pune",
        },
        id: "tool_call_1",
        name: "weather",
      },
      type: ShiroEventType.ToolStarted,
    },
    {
      result: {
        durationMs: 25,
        name: "weather",
        output: {
          condition: "cloudy",
        },
        state: ToolExecutionState.Completed,
        toolCallId: "tool_call_1",
      },
      runId,
      timestamp: new Date("2026-08-01T00:00:00.225Z"),
      type: ShiroEventType.ToolCompleted,
    },
    {
      fromAgent: "Manager",
      runId,
      timestamp: new Date("2026-08-01T00:00:00.300Z"),
      toAgent: "Research",
      type: ShiroEventType.AgentHandoffStarted,
    },
    {
      fromAgent: "Manager",
      runId,
      timestamp: new Date("2026-08-01T00:00:00.350Z"),
      toAgent: "Research",
      type: ShiroEventType.AgentHandoffCompleted,
    },
    {
      runId,
      timestamp: new Date("2026-08-01T00:00:00.400Z"),
      toolCall: {
        id: "tool_call_2",
        name: "deploy",
      },
      type: ShiroEventType.ApprovalRequested,
    },
    {
      runId,
      timestamp: new Date("2026-08-01T00:00:00.450Z"),
      toolCall: {
        id: "tool_call_2",
        name: "deploy",
      },
      type: ShiroEventType.ApprovalGranted,
    },
    {
      attempt: 0,
      runId,
      timestamp: new Date("2026-08-01T00:00:00.500Z"),
      type: ShiroEventType.OutputValidationStarted,
    },
    {
      attempt: 0,
      runId,
      timestamp: new Date("2026-08-01T00:00:00.525Z"),
      type: ShiroEventType.OutputValidationSucceeded,
    },
    {
      recordCount: 1,
      runId,
      timestamp: new Date("2026-08-01T00:00:00.600Z"),
      type: ShiroEventType.MemoryStored,
    },
    {
      runId,
      sessionId: "session_test",
      timestamp: new Date("2026-08-01T00:00:00.700Z"),
      type: ShiroEventType.SessionUpdated,
    },
    {
      runId,
      timestamp: finished,
      type: ShiroEventType.RunCompleted,
    },
  ];
}
