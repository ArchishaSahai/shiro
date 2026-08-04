import { ShiroEventType, type ShiroEvent } from "../events/index.js";
import { createId } from "../engine/ids.js";
import type { StudioWireEvent, StudioWireJson, StudioWirePayload } from "./types.js";

interface MapContext {
  readonly offsetMs: number;
  readonly agentName: string;
}

/**
 * Maps a Shiro lifecycle event into one or more Studio wire events.
 */
export function mapShiroEventToStudio(
  event: ShiroEvent,
  context: MapContext
): readonly StudioWireEvent[] {
  const base = {
    id: createId("evt"),
    offsetMs: context.offsetMs,
    runId: event.runId,
  };

  switch (event.type) {
    case ShiroEventType.AgentStarted:
      return [
        wire(base, "agent.start", {
          message: `agent.start ${event.agentName}`,
          terminalKind: "event",
          payload: { agentName: event.agentName },
        }),
        wire(base, "agent.calling", {
          message: `agent.calling ${event.agentName}`,
          payload: { agentName: event.agentName },
        }),
      ];
    case ShiroEventType.RunStarted: {
      const inputText = typeof event.input === "string" ? event.input : summarizeJson(event.input);
      return [
        wire(base, "run.started", {
          message: `run.started ${event.runId}`,
          terminalKind: "command",
          payload: { agentName: context.agentName },
        }),
        wire(base, "engine.started", {
          message: "engine.started",
          terminalKind: "success",
          payload: { agentName: context.agentName },
        }),
        wire(base, "prompt.built", {
          message: `prompt.built (${truncate(inputText, 80)})`,
          terminalKind: "muted",
          payload: { agentName: context.agentName },
        }),
      ];
    }
    case ShiroEventType.ProviderStarted:
      return [
        wire(base, "llm.request", {
          message: `llm.request ${event.providerName}`,
          terminalKind: "event",
          payload: { provider: event.providerName, agentName: context.agentName },
        }),
        wire(base, "provider.call.started", {
          message: `provider.call.started ${event.providerName}`,
          payload: {
            provider: event.providerName,
            spanId: `provider:${event.runId}:${String(context.offsetMs)}`,
            spanName: event.providerName,
            spanCategory: "provider",
          },
        }),
      ];
    case ShiroEventType.ProviderFinished:
      return [
        wire(base, "llm.response", {
          message: `llm.response ${event.providerName}`,
          terminalKind: "success",
          payload: { provider: event.providerName },
        }),
        wire(base, "provider.call.completed", {
          message: `provider.call.completed ${event.providerName}`,
          payload: {
            provider: event.providerName,
            spanId: `provider:${event.runId}:${String(context.offsetMs)}`,
            status: "completed",
          },
        }),
      ];
    case ShiroEventType.ToolStarted:
    case ShiroEventType.ToolRequested:
      return [
        wire(base, "tool.start", {
          message: `tool.start ${event.toolCall.name}`,
          terminalKind: "event",
          payload: {
            toolName: event.toolCall.name,
            arguments: toWireRecord(event.toolCall.arguments),
            spanId: `tool:${event.toolCall.id ?? event.toolCall.name}`,
            spanName: event.toolCall.name,
            spanCategory: "tool",
            status: "running",
          },
        }),
        wire(base, "tool.started", {
          payload: {
            toolName: event.toolCall.name,
            arguments: toWireRecord(event.toolCall.arguments),
            spanId: `tool:${event.toolCall.id ?? event.toolCall.name}`,
          },
        }),
      ];
    case ShiroEventType.ToolCompleted:
    case ShiroEventType.ToolFinished:
      return [
        wire(base, "tool.end", {
          message: `tool.end ${event.result.name}`,
          terminalKind: "success",
          payload: {
            toolName: event.result.name,
            result: toWireJson(event.result.output),
            status: "completed",
            durationMs: event.result.durationMs,
            spanId: `tool:${event.result.toolCallId ?? event.result.name}`,
          },
        }),
        wire(base, "tool.completed", {
          payload: {
            toolName: event.result.name,
            result: toWireJson(event.result.output),
            status: "completed",
            durationMs: event.result.durationMs,
            spanId: `tool:${event.result.toolCallId ?? event.result.name}`,
          },
        }),
      ];
    case ShiroEventType.ToolFailed:
    case ShiroEventType.ToolTimedOut:
      return [
        wire(base, "tool.failed", {
          message: `tool.failed ${event.result.name}`,
          terminalKind: "error",
          payload: {
            toolName: event.result.name,
            status: "failed",
            error: event.result.error?.message ?? "Tool failed",
            result: toWireJson(event.result.output),
            durationMs: event.result.durationMs,
            spanId: `tool:${event.result.toolCallId ?? event.result.name}`,
          },
        }),
      ];
    case ShiroEventType.AgentHandoffStarted:
    case ShiroEventType.AgentHandoffRequested:
      return [
        wire(base, "handoff", {
          message: `handoff ${event.fromAgent} → ${event.toAgent}`,
          terminalKind: "pink",
          payload: {
            sourceAgent: event.fromAgent,
            destinationAgent: event.toAgent,
            spanId: `handoff:${event.fromAgent}:${event.toAgent}`,
          },
        }),
        wire(base, "handoff.started", {
          payload: {
            sourceAgent: event.fromAgent,
            destinationAgent: event.toAgent,
            spanId: `handoff:${event.fromAgent}:${event.toAgent}`,
          },
        }),
      ];
    case ShiroEventType.AgentHandoffCompleted:
      return [
        wire(base, "handoff.completed", {
          message: `handoff.completed ${event.fromAgent} → ${event.toAgent}`,
          terminalKind: "pink",
          payload: {
            sourceAgent: event.fromAgent,
            destinationAgent: event.toAgent,
            spanId: `handoff:${event.fromAgent}:${event.toAgent}`,
            status: "completed",
          },
        }),
      ];
    case ShiroEventType.HandoffRequested:
      return [
        wire(base, "handoff", {
          message: `handoff → ${event.targetAgent ?? "unknown"}`,
          terminalKind: "pink",
          payload: {
            destinationAgent: event.targetAgent,
            sourceAgent: context.agentName,
          },
        }),
      ];
    case ShiroEventType.HandoffCompleted:
      return [
        wire(base, "handoff.completed", {
          message: `handoff.completed → ${event.targetAgent}`,
          terminalKind: "pink",
          payload: {
            destinationAgent: event.targetAgent,
            sourceAgent: context.agentName,
            status: "completed",
          },
        }),
      ];
    case ShiroEventType.GuardrailChecked:
      return [
        wire(base, "guardrail", {
          message: `guardrail ${event.guardrailName}`,
          terminalKind: "muted",
          payload: { guardrailName: event.guardrailName, status: "checked" },
        }),
      ];
    case ShiroEventType.GuardrailViolated:
      return [
        wire(base, "guardrail", {
          message: `guardrail violated ${event.guardrailName}`,
          terminalKind: "error",
          payload: { guardrailName: event.guardrailName, status: "violated" },
        }),
      ];
    case ShiroEventType.MemoryRetrieved:
      return [
        wire(base, "memory.update", {
          message: `memory.retrieved records=${String(event.recordCount)}`,
          terminalKind: "muted",
          payload: {
            kind: "retrieved",
            recordCount: event.recordCount,
            memoryDiff: "inserted",
          },
        }),
        wire(base, "memory.retrieved", {
          payload: { kind: "retrieved", recordCount: event.recordCount },
        }),
      ];
    case ShiroEventType.MemoryStored:
    case ShiroEventType.MemoryUpdated:
      return [
        wire(base, "memory.update", {
          message: `memory.stored records=${String(event.recordCount)}`,
          terminalKind: "event",
          payload: {
            kind: "stored",
            recordCount: event.recordCount,
            memoryDiff: "modified",
          },
        }),
        wire(base, "memory.stored", {
          payload: {
            kind: "stored",
            recordCount: event.recordCount,
          },
        }),
      ];
    case ShiroEventType.MemoryCompacted:
      return [
        wire(base, "memory.compacted", {
          message: "memory.compacted",
          payload: { kind: "compacted" },
        }),
      ];
    case ShiroEventType.SessionLoaded:
    case ShiroEventType.SessionCreated:
      return [
        wire(base, "memory.session_loaded", {
          message: `session ${event.sessionId}`,
          terminalKind: "muted",
          payload: { sessionId: event.sessionId, kind: "session_loaded" },
        }),
      ];
    case ShiroEventType.ContextPrepared:
      return [
        wire(base, "prompt.built", {
          message: `context prepared (${String(event.messageCount)} messages)`,
          terminalKind: "muted",
          payload: { messageCount: event.messageCount },
        }),
      ];
    case ShiroEventType.ApprovalRequested:
      return [
        wire(base, "approval.requested", {
          message: `approval.requested ${event.toolCall.name}`,
          terminalKind: "warning",
          payload: { toolName: event.toolCall.name, status: "pending" },
        }),
      ];
    case ShiroEventType.ApprovalGranted:
      return [
        wire(base, "approval.granted", {
          message: `approval.granted ${event.toolCall.name}`,
          terminalKind: "success",
          payload: { toolName: event.toolCall.name, decision: "approval.granted" },
        }),
      ];
    case ShiroEventType.ApprovalRejected:
    case ShiroEventType.ApprovalTimedOut:
    case ShiroEventType.ApprovalCancelled:
      return [
        wire(base, "approval.rejected", {
          message: `approval.rejected ${event.toolCall.name}`,
          terminalKind: "error",
          payload: {
            toolName: event.toolCall.name,
            decision: "approval.rejected",
            reason: "reason" in event ? event.reason : undefined,
          },
        }),
      ];
    case ShiroEventType.RunCompleted:
      return [
        wire(base, "trace.end", {
          message: "trace.end",
          terminalKind: "success",
          payload: { finalStatus: "completed" },
        }),
        wire(base, "run.completed", {
          message: "run.completed",
          terminalKind: "success",
          payload: { finalStatus: "completed" },
        }),
      ];
    case ShiroEventType.RunFailed:
      return [
        wire(base, "run.failed", {
          message: `run.failed ${event.error.message}`,
          terminalKind: "error",
          payload: {
            finalStatus: "failed",
            error: event.error.message,
          },
        }),
        wire(base, "trace.end", {
          message: "trace.end (failed)",
          terminalKind: "error",
          payload: { finalStatus: "failed", error: event.error.message },
        }),
      ];
    case ShiroEventType.TraceCompleted:
      return [
        wire(base, "trace.end", {
          message: "trace.end",
          terminalKind: "success",
          payload: { finalStatus: "completed" },
        }),
      ];
    default:
      return [
        wire(base, "terminal.line", {
          message: event.type,
          terminalKind: "muted",
          payload: { status: event.type },
        }),
      ];
  }
}

function wire(
  base: { id: string; offsetMs: number; runId: string },
  type: StudioWireEvent["type"],
  extra: {
    message?: string;
    terminalKind?: StudioWireEvent["terminalKind"];
    payload?: Record<string, unknown>;
  }
): StudioWireEvent {
  return {
    id: `${base.id}:${type}`,
    offsetMs: base.offsetMs,
    runId: base.runId,
    type,
    ...(extra.message === undefined ? {} : { message: extra.message }),
    ...(extra.terminalKind === undefined ? {} : { terminalKind: extra.terminalKind }),
    ...(extra.payload === undefined ? {} : { payload: cleanPayload(extra.payload) }),
  };
}

function cleanPayload(payload: Record<string, unknown>): StudioWirePayload {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function toWireJson(value: unknown): StudioWireJson | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as StudioWireJson;
  } catch {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return null;
  }
}

function toWireRecord(value: unknown): Readonly<Record<string, StudioWireJson>> | undefined {
  const json = toWireJson(value);
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return undefined;
  }
  return json as unknown as Readonly<Record<string, StudioWireJson>>;
}

function summarizeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
