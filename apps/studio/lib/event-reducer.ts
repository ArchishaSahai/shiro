import type { RuntimeMetrics, StudioRuntimeEvent, TerminalLine } from "@/lib/runtime-events";
import type {
  StudioApprovalTrace,
  StudioHandoffTrace,
  StudioMemoryTrace,
  StudioModelCallTrace,
  StudioRunTrace,
  StudioTokenUsage,
  StudioToolExecutionTrace,
  StudioTraceEvent,
  StudioTraceSpan,
} from "@/lib/trace-utils";

export interface LiveRunState {
  readonly events: readonly StudioRuntimeEvent[];
  readonly terminalLines: readonly TerminalLine[];
  readonly metrics: RuntimeMetrics;
  readonly selectedTool: string | null;
  readonly responseMarkdown: string | null;
  readonly trace: StudioRunTrace | null;
  readonly activeNodeIds: readonly string[];
}

export function createEmptyLiveState(): LiveRunState {
  return {
    activeNodeIds: [],
    events: [],
    metrics: {
      approvals: 0,
      cost: 0,
      elapsedMs: 0,
      handoffs: 0,
      providerLatencyMs: 0,
      tokens: 0,
      toolLatencyMs: 0,
      tools: 0,
    },
    responseMarkdown: null,
    selectedTool: null,
    terminalLines: [],
    trace: null,
  };
}

export function reduceRuntimeEvent(state: LiveRunState, event: StudioRuntimeEvent): LiveRunState {
  const normalized = normalizeEvent(event);
  const events = [...state.events, normalized];
  const terminalLines = appendTerminalLine(state.terminalLines, normalized);
  const trace = reduceTrace(state.trace, normalized);
  const metrics = deriveMetrics(trace, normalized.offsetMs);
  const selectedTool = normalized.payload?.toolName ?? state.selectedTool;
  const responseMarkdown =
    normalized.payload?.markdown ??
    (normalized.type === "response.completed" && typeof normalized.payload?.finalOutput === "string"
      ? normalized.payload.finalOutput
      : state.responseMarkdown);
  const activeNodeIds = deriveActiveNodes(trace, normalized);

  return {
    activeNodeIds,
    events,
    metrics,
    responseMarkdown,
    selectedTool,
    terminalLines,
    trace,
  };
}

function normalizeEvent(event: StudioRuntimeEvent): StudioRuntimeEvent {
  const aliases: Partial<Record<StudioRuntimeEvent["type"], StudioRuntimeEvent["type"]>> = {
    "agent.start": "agent.calling",
    "tool.start": "tool.started",
    "tool.end": "tool.completed",
    handoff: "handoff.started",
    "memory.update": "memory.stored",
    "llm.request": "provider.call.started",
    "llm.response": "provider.call.completed",
    "trace.end": "run.completed",
    output: "response.completed",
  };
  const mapped = aliases[event.type];
  if (mapped === undefined) {
    return event;
  }
  return { ...event, type: mapped };
}

function appendTerminalLine(
  lines: readonly TerminalLine[],
  event: StudioRuntimeEvent
): readonly TerminalLine[] {
  if (event.message === undefined && event.payload?.markdown === undefined) {
    return lines;
  }

  const kind = event.terminalKind ?? kindFromType(event.type);
  const text = event.message ?? "";
  const markdown = event.payload?.markdown;

  if (kind === "markdown" && markdown !== undefined) {
    return [
      ...lines,
      {
        id: event.id,
        kind,
        markdown,
        text: text.length > 0 ? text : "Assistant response",
      },
    ];
  }

  if (text.length === 0) {
    return lines;
  }

  return [...lines, { id: event.id, kind, text }];
}

function kindFromType(type: StudioRuntimeEvent["type"]): TerminalLine["kind"] {
  if (type === "run.failed" || type === "tool.failed" || type === "approval.rejected") {
    return "error";
  }
  if (
    type === "engine.started" ||
    type === "provider.connected" ||
    type === "tool.completed" ||
    type === "approval.granted" ||
    type === "run.completed" ||
    type === "response.completed"
  ) {
    return "success";
  }
  if (type === "approval.requested") {
    return "warning";
  }
  if (type === "handoff.started" || type === "handoff.completed") {
    return "pink";
  }
  if (type === "run.started") {
    return "command";
  }
  return "event";
}

function reduceTrace(
  current: StudioRunTrace | null,
  event: StudioRuntimeEvent
): StudioRunTrace | null {
  const base = current ?? createBaseTrace(event);
  if (base === null) {
    return null;
  }

  const payload = event.payload ?? {};
  const timestamp = new Date(base.startTime.getTime() + event.offsetMs);
  const timelineEvent: StudioTraceEvent = {
    eventId: event.id,
    runId: event.runId,
    timestamp,
    type: event.type,
  };

  let next: StudioRunTrace = {
    ...base,
    timeline: {
      events: [...base.timeline.events, timelineEvent],
      spans: [...base.timeline.spans],
    },
  };

  next = withOptional(next, {
    agentName: payload.agentName,
    model: payload.model,
    provider: payload.provider,
    sessionId: payload.sessionId,
  });

  switch (event.type) {
    case "run.started": {
      next = { ...next, finalStatus: "running", startTime: timestamp };
      break;
    }
    case "tool.started": {
      if (payload.toolName !== undefined) {
        next = {
          ...next,
          toolExecutions: upsertTool(next.toolExecutions, {
            status: "running",
            toolName: payload.toolName,
            ...(payload.arguments === undefined ? {} : { arguments: payload.arguments }),
          }),
          totalIterations: next.totalIterations + 1,
        };
        next = upsertSpan(next, {
          category: "tool",
          name: payload.toolName,
          spanId: payload.spanId ?? `tool:${payload.toolName}`,
          startTime: timestamp,
          status: "running",
        });
      }
      break;
    }
    case "tool.completed":
    case "tool.failed": {
      if (payload.toolName !== undefined) {
        next = {
          ...next,
          toolExecutions: upsertTool(next.toolExecutions, {
            status: event.type === "tool.failed" ? "failed" : (payload.status ?? "completed"),
            toolName: payload.toolName,
            ...(payload.arguments === undefined ? {} : { arguments: payload.arguments }),
            ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
            ...(payload.result === undefined
              ? { serializedResult: null }
              : { serializedResult: payload.result }),
          }),
        };
        next = endSpan(next, payload.spanId ?? `tool:${payload.toolName}`, {
          endTime: timestamp,
          status: event.type === "tool.failed" ? "failed" : (payload.status ?? "completed"),
          ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
        });
      }
      break;
    }
    case "handoff.started":
    case "handoff.completed": {
      if (payload.sourceAgent !== undefined && payload.destinationAgent !== undefined) {
        const handoff = {
          destinationAgent: payload.destinationAgent,
          sourceAgent: payload.sourceAgent,
          timestamp,
          ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
          ...(payload.reason === undefined ? {} : { reason: payload.reason }),
        } satisfies StudioHandoffTrace;

        if (event.type === "handoff.started") {
          next = upsertSpan(next, {
            category: "handoff",
            name: `${payload.sourceAgent} → ${payload.destinationAgent}`,
            spanId: payload.spanId ?? `handoff:${payload.sourceAgent}:${payload.destinationAgent}`,
            startTime: timestamp,
            status: "running",
          });
        } else {
          next = {
            ...next,
            agentName: payload.destinationAgent,
            handoffs: upsertHandoff(next.handoffs, handoff),
          };
          next = endSpan(
            next,
            payload.spanId ?? `handoff:${payload.sourceAgent}:${payload.destinationAgent}`,
            {
              endTime: timestamp,
              status: "completed",
              ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
            }
          );
        }
      }
      break;
    }
    case "approval.requested":
    case "approval.granted":
    case "approval.rejected": {
      if (payload.toolName !== undefined) {
        const decision =
          event.type === "approval.requested"
            ? "approval.pending"
            : event.type === "approval.granted"
              ? "approval.granted"
              : "approval.rejected";
        const approval = {
          decision,
          timestamp,
          toolName: payload.toolName,
          ...(payload.approver === undefined ? {} : { approver: payload.approver }),
          ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
          ...(payload.policy === undefined ? {} : { policy: payload.policy }),
        } satisfies StudioApprovalTrace;

        next = { ...next, approvals: upsertApproval(next.approvals, approval) };

        if (event.type === "approval.requested") {
          next = upsertSpan(next, {
            category: "approval",
            name: payload.toolName,
            spanId: payload.spanId ?? `approval:${payload.toolName}`,
            startTime: timestamp,
            status: "pending",
          });
        } else {
          next = endSpan(next, payload.spanId ?? `approval:${payload.toolName}`, {
            endTime: timestamp,
            status: decision,
            ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
          });
        }
      }
      break;
    }
    case "memory.session_loaded":
    case "memory.retrieved":
    case "memory.stored":
    case "memory.compacted": {
      const kind =
        payload.kind ??
        event.type.replace("memory.", "").replace("session_loaded", "session_loaded");
      const memory = {
        kind,
        timestamp,
        ...(payload.messageCount === undefined ? {} : { messageCount: payload.messageCount }),
        ...(payload.recordCount === undefined ? {} : { recordCount: payload.recordCount }),
        ...(payload.sessionId === undefined && next.sessionId === undefined
          ? {}
          : { sessionId: payload.sessionId ?? next.sessionId }),
        ...(payload.before === undefined ? {} : { before: payload.before }),
        ...(payload.after === undefined ? {} : { after: payload.after }),
        ...(payload.memoryDiff === undefined ? {} : { memoryDiff: payload.memoryDiff }),
      } satisfies StudioMemoryTrace;

      next = { ...next, memory: [...next.memory, memory] };
      next = upsertSpan(next, {
        category: "memory",
        durationMs: 40,
        endTime: new Date(timestamp.getTime() + 40),
        name: kind,
        spanId: payload.spanId ?? `memory:${kind}:${event.id}`,
        startTime: timestamp,
        status: "completed",
      });
      break;
    }
    case "provider.call.started": {
      const call = {
        providerName: payload.provider ?? next.provider ?? "provider",
        requestTimestamp: timestamp,
        ...(payload.model === undefined && next.model === undefined
          ? {}
          : { model: payload.model ?? next.model }),
        ...(payload.retryNumber === undefined ? {} : { retryNumber: payload.retryNumber }),
      } satisfies StudioModelCallTrace;

      next = { ...next, modelCalls: [...next.modelCalls, call] };
      next = upsertSpan(next, {
        category: "provider",
        name: payload.model ?? next.model ?? "model",
        spanId: payload.spanId ?? `provider:${String(next.modelCalls.length - 1)}`,
        startTime: timestamp,
        status: "running",
      });
      break;
    }
    case "provider.call.completed": {
      const calls = [...next.modelCalls];
      const last = calls[calls.length - 1];
      if (last !== undefined) {
        const tokenUsage = buildTokenUsage({
          ...(payload.estimatedCost === undefined ? {} : { estimatedCost: payload.estimatedCost }),
          ...(payload.inputTokens === undefined ? {} : { inputTokens: payload.inputTokens }),
          ...(payload.outputTokens === undefined ? {} : { outputTokens: payload.outputTokens }),
          ...(payload.totalTokens === undefined ? {} : { totalTokens: payload.totalTokens }),
        });
        calls[calls.length - 1] = {
          ...last,
          responseTimestamp: timestamp,
          ...(payload.finishReason === undefined ? {} : { finishReason: payload.finishReason }),
          ...(payload.latencyMs === undefined && payload.durationMs === undefined
            ? {}
            : { latencyMs: payload.latencyMs ?? payload.durationMs }),
          ...(tokenUsage === undefined ? {} : { tokenUsage }),
        };
        next = { ...next, modelCalls: calls };
      }
      next = endSpan(
        next,
        payload.spanId ?? `provider:${String(Math.max(0, next.modelCalls.length - 1))}`,
        {
          endTime: timestamp,
          status: "completed",
          ...(payload.latencyMs === undefined && payload.durationMs === undefined
            ? {}
            : { durationMs: payload.latencyMs ?? payload.durationMs }),
        }
      );
      break;
    }
    case "response.completed":
    case "run.completed":
    case "run.failed": {
      const finalStatus =
        event.type === "run.failed" ? "failed" : (payload.finalStatus ?? "completed");
      const totalTokens =
        payload.totalTokens ??
        next.modelCalls.reduce((sum, call) => sum + (call.tokenUsage?.totalTokens ?? 0), 0);
      const tokenUsage = buildTokenUsage({
        totalTokens,
        ...(payload.estimatedCost !== undefined
          ? { estimatedCost: payload.estimatedCost }
          : next.tokenUsage?.estimatedCost !== undefined
            ? { estimatedCost: next.tokenUsage.estimatedCost }
            : {}),
        ...(payload.inputTokens !== undefined
          ? { inputTokens: payload.inputTokens }
          : next.tokenUsage?.inputTokens !== undefined
            ? { inputTokens: next.tokenUsage.inputTokens }
            : {}),
        ...(payload.outputTokens !== undefined
          ? { outputTokens: payload.outputTokens }
          : next.tokenUsage?.outputTokens !== undefined
            ? { outputTokens: next.tokenUsage.outputTokens }
            : {}),
      });

      next = {
        ...next,
        endTime: timestamp,
        finalStatus,
        totalDurationMs: event.offsetMs,
        ...(tokenUsage === undefined ? {} : { tokenUsage }),
        ...(payload.finalOutput === undefined && payload.markdown === undefined
          ? {}
          : { finalOutput: payload.finalOutput ?? payload.markdown }),
      };
      break;
    }
    case "span.started": {
      if (payload.spanId !== undefined && payload.spanName !== undefined) {
        next = upsertSpan(next, {
          category: payload.spanCategory ?? "run",
          name: payload.spanName,
          spanId: payload.spanId,
          startTime: timestamp,
          status: "running",
        });
      }
      break;
    }
    case "span.ended": {
      if (payload.spanId !== undefined) {
        next = endSpan(next, payload.spanId, {
          endTime: timestamp,
          status: payload.status ?? "completed",
          ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
        });
      }
      break;
    }
    default:
      break;
  }

  return next;
}

const TRACE_TIME_ORIGIN_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

function createBaseTrace(event: StudioRuntimeEvent): StudioRunTrace | null {
  if (event.runId.length === 0) {
    return null;
  }

  const payload = event.payload ?? {};
  return {
    approvals: [],
    finalStatus: "running",
    handoffs: [],
    memory: [],
    modelCalls: [],
    runId: event.runId,
    // Fixed origin + offsetMs keeps SSR/client timestamps identical.
    startTime: new Date(TRACE_TIME_ORIGIN_MS),
    timeline: { events: [], spans: [] },
    toolExecutions: [],
    totalIterations: 0,
    ...(payload.agentName === undefined ? {} : { agentName: payload.agentName }),
    ...(payload.model === undefined ? {} : { model: payload.model }),
    ...(payload.provider === undefined ? {} : { provider: payload.provider }),
    ...(payload.sessionId === undefined ? {} : { sessionId: payload.sessionId }),
  };
}

function deriveMetrics(trace: StudioRunTrace | null, elapsedMs: number): RuntimeMetrics {
  if (trace === null) {
    return {
      approvals: 0,
      cost: 0,
      elapsedMs,
      handoffs: 0,
      providerLatencyMs: 0,
      tokens: 0,
      toolLatencyMs: 0,
      tools: 0,
    };
  }

  return {
    approvals: trace.approvals.length,
    cost: trace.tokenUsage?.estimatedCost ?? 0,
    elapsedMs: trace.totalDurationMs ?? elapsedMs,
    handoffs: trace.handoffs.length,
    providerLatencyMs: trace.modelCalls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0),
    tokens: trace.modelCalls.reduce((sum, call) => sum + (call.tokenUsage?.totalTokens ?? 0), 0),
    toolLatencyMs: trace.toolExecutions.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0),
    tools: trace.toolExecutions.length,
  };
}

function deriveActiveNodes(
  trace: StudioRunTrace | null,
  event: StudioRuntimeEvent
): readonly string[] {
  if (trace === null) {
    return [];
  }

  const ids: string[] = [];
  if (trace.agentName !== undefined) {
    ids.push(`agent:${trace.agentName}`);
  }

  const payload = event.payload;
  if (payload?.toolName !== undefined) {
    ids.push(`tool:${payload.toolName}`);
  }
  if (payload?.destinationAgent !== undefined) {
    ids.push(`agent:${payload.destinationAgent}`);
  }
  if (event.type.startsWith("provider.")) {
    ids.push(`provider:${String(Math.max(0, trace.modelCalls.length - 1))}`);
  }
  if (event.type.startsWith("approval.") && payload?.toolName !== undefined) {
    ids.push(`approval:${payload.toolName}:0`);
  }
  if (event.type.startsWith("memory.")) {
    ids.push(`memory:${payload?.kind ?? "memory"}:0`);
  }

  return ids;
}

function upsertTool(
  tools: readonly StudioToolExecutionTrace[],
  tool: StudioToolExecutionTrace
): readonly StudioToolExecutionTrace[] {
  const index = tools.findIndex((entry) => entry.toolName === tool.toolName);
  if (index === -1) {
    return [...tools, tool];
  }
  const next = [...tools];
  next[index] = { ...tools[index], ...tool };
  return next;
}

function upsertApproval(
  approvals: readonly StudioApprovalTrace[],
  approval: StudioApprovalTrace
): readonly StudioApprovalTrace[] {
  const index = approvals.findIndex((entry) => entry.toolName === approval.toolName);
  if (index === -1) {
    return [...approvals, approval];
  }
  const next = [...approvals];
  next[index] = { ...approvals[index], ...approval };
  return next;
}

function upsertHandoff(
  handoffs: readonly StudioHandoffTrace[],
  handoff: StudioHandoffTrace
): readonly StudioHandoffTrace[] {
  if (hasHandoff(handoffs, handoff)) {
    return handoffs.map((entry) =>
      entry.sourceAgent === handoff.sourceAgent &&
      entry.destinationAgent === handoff.destinationAgent
        ? handoff
        : entry
    );
  }
  return [...handoffs, handoff];
}

function hasHandoff(handoffs: readonly StudioHandoffTrace[], handoff: StudioHandoffTrace): boolean {
  return handoffs.some(
    (entry) =>
      entry.sourceAgent === handoff.sourceAgent &&
      entry.destinationAgent === handoff.destinationAgent
  );
}

function upsertSpan(trace: StudioRunTrace, span: StudioTraceSpan): StudioRunTrace {
  const spans = [...trace.timeline.spans];
  const index = spans.findIndex((entry) => entry.spanId === span.spanId);
  if (index === -1) {
    spans.push(span);
  } else {
    spans[index] = { ...spans[index], ...span };
  }
  return {
    ...trace,
    timeline: { ...trace.timeline, spans },
  };
}

function endSpan(
  trace: StudioRunTrace,
  spanId: string,
  patch: Partial<Pick<StudioTraceSpan, "durationMs" | "endTime" | "status">> &
    Pick<StudioTraceSpan, "endTime" | "status">
): StudioRunTrace {
  const spans = trace.timeline.spans.map((span) =>
    span.spanId === spanId ? { ...span, ...patch } : span
  );
  return {
    ...trace,
    timeline: { ...trace.timeline, spans },
  };
}

function buildTokenUsage(payload: {
  estimatedCost?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): StudioTokenUsage | undefined {
  const usage: {
    estimatedCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } = {};

  if (payload.estimatedCost !== undefined) {
    usage.estimatedCost = payload.estimatedCost;
  }
  if (payload.inputTokens !== undefined) {
    usage.inputTokens = payload.inputTokens;
  }
  if (payload.outputTokens !== undefined) {
    usage.outputTokens = payload.outputTokens;
  }
  if (payload.totalTokens !== undefined) {
    usage.totalTokens = payload.totalTokens;
  }

  return Object.keys(usage).length === 0 ? undefined : usage;
}

function withOptional<T extends object>(
  value: T,
  patch: { readonly [K in keyof T]?: T[K] | undefined }
): T {
  const next = { ...value };
  for (const [key, entry] of Object.entries(patch) as [keyof T, T[keyof T] | undefined][]) {
    if (entry !== undefined) {
      next[key] = entry;
    }
  }
  return next;
}
