export type StudioTraceStatus = "running" | "completed" | "failed";
export type StudioJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly StudioJsonValue[]
  | { readonly [key: string]: StudioJsonValue };

export interface StudioTraceSnapshot {
  readonly createdAt: Date;
  readonly statistics: StudioTraceStatistics;
  readonly traces: readonly StudioRunTrace[];
}

export interface StudioTraceStatistics {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly failedRuns: number;
  readonly averageDurationMs?: number;
  readonly totalProviderCalls: number;
  readonly totalToolExecutions: number;
  readonly totalHandoffs: number;
  readonly totalApprovals: number;
}

export interface StudioRunTrace {
  readonly runId: string;
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly totalDurationMs?: number;
  readonly finalStatus: StudioTraceStatus;
  readonly finalOutput?: StudioJsonValue;
  readonly totalIterations: number;
  readonly tokenUsage?: StudioTokenUsage;
  readonly approvals: readonly StudioApprovalTrace[];
  readonly handoffs: readonly StudioHandoffTrace[];
  readonly memory: readonly StudioMemoryTrace[];
  readonly modelCalls: readonly StudioModelCallTrace[];
  readonly timeline: StudioTraceTimeline;
  readonly toolExecutions: readonly StudioToolExecutionTrace[];
}

export interface StudioTokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCost?: number;
}

export interface StudioModelCallTrace {
  readonly providerName: string;
  readonly model?: string;
  readonly requestTimestamp: Date;
  readonly responseTimestamp?: Date;
  readonly latencyMs?: number;
  readonly retryNumber?: number;
  readonly finishReason?: string;
  readonly tokenUsage?: StudioTokenUsage;
}

export interface StudioToolExecutionTrace {
  readonly toolName: string;
  readonly arguments?: JsonObjectLike;
  readonly durationMs?: number;
  readonly status: string;
  readonly serializedResult?: StudioJsonValue;
}

export interface StudioHandoffTrace {
  readonly sourceAgent: string;
  readonly destinationAgent: string;
  readonly timestamp: Date;
  readonly reason?: string;
  readonly durationMs?: number;
}

export interface StudioApprovalTrace {
  readonly toolName: string;
  readonly timestamp: Date;
  readonly decision?: string;
  readonly policy?: string;
  readonly timeoutMs?: number;
  readonly approver?: string;
  readonly durationMs?: number;
}

export interface StudioMemoryTrace {
  readonly kind: string;
  readonly timestamp: Date;
  readonly recordCount?: number;
  readonly messageCount?: number;
  readonly sessionId?: string;
  readonly before?: StudioJsonValue;
  readonly after?: StudioJsonValue;
  readonly memoryDiff?: "inserted" | "modified" | "removed";
}

export interface StudioTraceTimeline {
  readonly events: readonly StudioTraceEvent[];
  readonly spans: readonly StudioTraceSpan[];
}

export interface StudioTraceEvent {
  readonly eventId: string;
  readonly runId: string;
  readonly type: string;
  readonly timestamp: Date;
}

export interface StudioTraceSpan {
  readonly spanId: string;
  readonly name: string;
  readonly category: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly durationMs?: number;
  readonly status: string;
}

type JsonObjectLike = Readonly<Record<string, StudioJsonValue>>;

export function parseTraceSnapshot(input: unknown): StudioTraceSnapshot | null {
  if (!isRecord(input)) {
    return null;
  }

  const traces = Array.isArray(input.traces)
    ? input.traces.map(parseRunTrace).filter(isRunTrace)
    : [];

  if (traces.length === 0) {
    return null;
  }

  return {
    createdAt: parseDate(input.createdAt) ?? new Date(),
    statistics: isRecord(input.statistics)
      ? {
          completedRuns: Number(input.statistics.completedRuns ?? 0),
          failedRuns: Number(input.statistics.failedRuns ?? 0),
          totalApprovals: Number(input.statistics.totalApprovals ?? 0),
          totalHandoffs: Number(input.statistics.totalHandoffs ?? 0),
          totalProviderCalls: Number(input.statistics.totalProviderCalls ?? 0),
          totalRuns: Number(input.statistics.totalRuns ?? traces.length),
          totalToolExecutions: Number(input.statistics.totalToolExecutions ?? 0),
        }
      : deriveStatistics(traces),
    traces,
  };
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) {
    return "-";
  }

  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  return `${ms.toFixed(0)}ms`;
}

/** Deterministic clock label (UTC) — avoids SSR/client locale & timezone mismatches. */
export function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

/** Elapsed time from run start — stable across SSR/client even if absolute dates differ. */
export function formatElapsedTime(timestamp: Date, startTime: Date): string {
  const elapsedMs = Math.max(0, timestamp.getTime() - startTime.getTime());
  const totalSeconds = elapsedMs / 1000;
  if (totalSeconds < 60) {
    return `+${totalSeconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `+${String(minutes)}m ${seconds.toFixed(1)}s`;
}

export function statusTone(status: StudioTraceStatus): "success" | "danger" | "default" {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  return "default";
}

export function totalTokens(trace: StudioRunTrace): number | undefined {
  const total = trace.modelCalls.reduce(
    (sum, call) => sum + (call.tokenUsage?.totalTokens ?? 0),
    0
  );
  return total === 0 ? undefined : total;
}

export function providerLatency(trace: StudioRunTrace): number {
  return trace.modelCalls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0);
}

export function toolLatency(trace: StudioRunTrace): number {
  return trace.toolExecutions.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0);
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseRunTrace(input: unknown): StudioRunTrace | null {
  if (!isRecord(input) || typeof input.runId !== "string") {
    return null;
  }

  const trace: Partial<MutableStudioRunTrace> = {
    approvals: Array.isArray(input.approvals) ? input.approvals.flatMap(parseApproval) : [],
    finalStatus: parseStatus(input.finalStatus),
    handoffs: Array.isArray(input.handoffs) ? input.handoffs.flatMap(parseHandoff) : [],
    memory: Array.isArray(input.memory) ? input.memory.flatMap(parseMemory) : [],
    modelCalls: Array.isArray(input.modelCalls) ? input.modelCalls.flatMap(parseModelCall) : [],
    runId: input.runId,
    startTime: parseDate(input.startTime) ?? new Date(),
    timeline: parseTimeline(input.timeline),
    toolExecutions: Array.isArray(input.toolExecutions)
      ? input.toolExecutions.flatMap(parseToolExecution)
      : [],
    totalIterations: Number(input.totalIterations ?? 0),
  };

  assignOptional(trace, "agentName", stringOrUndefined(input.agentName));
  assignOptional(trace, "endTime", parseDate(input.endTime));
  assignOptional(
    trace,
    "finalOutput",
    isJsonValue(input.finalOutput) ? input.finalOutput : undefined
  );
  assignOptional(trace, "provider", stringOrUndefined(input.provider));
  assignOptional(trace, "sessionId", stringOrUndefined(input.sessionId));
  assignOptional(trace, "totalDurationMs", numberOrUndefined(input.totalDurationMs));

  return trace as StudioRunTrace;
}

function parseTimeline(input: unknown): StudioTraceTimeline {
  if (!isRecord(input)) {
    return { events: [], spans: [] };
  }

  return {
    events: Array.isArray(input.events)
      ? input.events.filter(isRecord).map((event) => ({
          eventId: stringOrUndefined(event.eventId) ?? crypto.randomUUID(),
          runId: stringOrUndefined(event.runId) ?? "",
          timestamp: parseDate(event.timestamp) ?? new Date(),
          type: stringOrUndefined(event.type) ?? "event",
        }))
      : [],
    spans: Array.isArray(input.spans)
      ? input.spans.filter(isRecord).map((span) => {
          const parsed: Partial<MutableStudioTraceSpan> = {
            category: stringOrUndefined(span.category) ?? "run",
            name: stringOrUndefined(span.name) ?? "Span",
            spanId: stringOrUndefined(span.spanId) ?? crypto.randomUUID(),
            startTime: parseDate(span.startTime) ?? new Date(),
            status: stringOrUndefined(span.status) ?? "completed",
          };

          assignOptional(parsed, "durationMs", numberOrUndefined(span.durationMs));
          assignOptional(parsed, "endTime", parseDate(span.endTime));

          return parsed as StudioTraceSpan;
        })
      : [],
  };
}

function parseModelCall(input: unknown): readonly StudioModelCallTrace[] {
  if (!isRecord(input) || typeof input.providerName !== "string") {
    return [];
  }

  const call: Partial<MutableStudioModelCallTrace> = {
    providerName: input.providerName,
    requestTimestamp: parseDate(input.requestTimestamp) ?? new Date(),
  };

  assignOptional(call, "finishReason", stringOrUndefined(input.finishReason));
  assignOptional(call, "latencyMs", numberOrUndefined(input.latencyMs));
  assignOptional(call, "model", stringOrUndefined(input.model));
  assignOptional(call, "responseTimestamp", parseDate(input.responseTimestamp));
  assignOptional(call, "retryNumber", numberOrUndefined(input.retryNumber));

  if (isRecord(input.tokenUsage)) {
    const tokenUsage: Partial<MutableTokenUsage> = {};
    assignOptional(tokenUsage, "estimatedCost", numberOrUndefined(input.tokenUsage.estimatedCost));
    assignOptional(tokenUsage, "inputTokens", numberOrUndefined(input.tokenUsage.inputTokens));
    assignOptional(tokenUsage, "outputTokens", numberOrUndefined(input.tokenUsage.outputTokens));
    assignOptional(tokenUsage, "totalTokens", numberOrUndefined(input.tokenUsage.totalTokens));
    call.tokenUsage = tokenUsage;
  }

  return [call as StudioModelCallTrace];
}

function parseToolExecution(input: unknown): readonly StudioToolExecutionTrace[] {
  if (!isRecord(input) || typeof input.toolName !== "string") {
    return [];
  }

  const tool: Partial<MutableStudioToolExecutionTrace> = {
    status: stringOrUndefined(input.status) ?? "completed",
    toolName: input.toolName,
  };

  assignOptional(
    tool,
    "arguments",
    isJsonObjectLike(input.arguments) ? input.arguments : undefined
  );
  assignOptional(tool, "durationMs", numberOrUndefined(input.durationMs));
  assignOptional(
    tool,
    "serializedResult",
    isJsonValue(input.serializedResult) ? input.serializedResult : undefined
  );

  return [tool as StudioToolExecutionTrace];
}

function parseHandoff(input: unknown): readonly StudioHandoffTrace[] {
  if (
    !isRecord(input) ||
    typeof input.sourceAgent !== "string" ||
    typeof input.destinationAgent !== "string"
  ) {
    return [];
  }

  const handoff: Partial<MutableStudioHandoffTrace> = {
    destinationAgent: input.destinationAgent,
    sourceAgent: input.sourceAgent,
    timestamp: parseDate(input.timestamp) ?? new Date(),
  };

  assignOptional(handoff, "durationMs", numberOrUndefined(input.durationMs));
  assignOptional(handoff, "reason", stringOrUndefined(input.reason));

  return [handoff as StudioHandoffTrace];
}

function parseApproval(input: unknown): readonly StudioApprovalTrace[] {
  if (!isRecord(input) || typeof input.toolName !== "string") {
    return [];
  }

  const approval: Partial<MutableStudioApprovalTrace> = {
    timestamp: parseDate(input.timestamp) ?? new Date(),
    toolName: input.toolName,
  };

  assignOptional(approval, "approver", stringOrUndefined(input.approver));
  assignOptional(approval, "decision", stringOrUndefined(input.decision));
  assignOptional(approval, "durationMs", numberOrUndefined(input.durationMs));
  assignOptional(approval, "policy", stringOrUndefined(input.policy));
  assignOptional(approval, "timeoutMs", numberOrUndefined(input.timeoutMs));

  return [approval as StudioApprovalTrace];
}

function parseMemory(input: unknown): readonly StudioMemoryTrace[] {
  if (!isRecord(input) || typeof input.kind !== "string") {
    return [];
  }

  const memory: Partial<MutableStudioMemoryTrace> = {
    kind: input.kind,
    timestamp: parseDate(input.timestamp) ?? new Date(),
  };

  assignOptional(memory, "messageCount", numberOrUndefined(input.messageCount));
  assignOptional(memory, "recordCount", numberOrUndefined(input.recordCount));
  assignOptional(memory, "sessionId", stringOrUndefined(input.sessionId));

  return [memory as StudioMemoryTrace];
}

function deriveStatistics(traces: readonly StudioRunTrace[]): StudioTraceStatistics {
  return {
    completedRuns: traces.filter((trace) => trace.finalStatus === "completed").length,
    failedRuns: traces.filter((trace) => trace.finalStatus === "failed").length,
    totalApprovals: traces.reduce((sum, trace) => sum + trace.approvals.length, 0),
    totalHandoffs: traces.reduce((sum, trace) => sum + trace.handoffs.length, 0),
    totalProviderCalls: traces.reduce((sum, trace) => sum + trace.modelCalls.length, 0),
    totalRuns: traces.length,
    totalToolExecutions: traces.reduce((sum, trace) => sum + trace.toolExecutions.length, 0),
  };
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseStatus(value: unknown): StudioTraceStatus {
  return value === "failed" || value === "running" ? value : "completed";
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isRunTrace(value: StudioRunTrace | null): value is StudioRunTrace {
  return value !== null;
}

function isJsonValue(value: unknown): value is StudioJsonValue {
  return (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    isRecord(value)
  );
}

function isJsonObjectLike(value: unknown): value is JsonObjectLike {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

type MutableStudioRunTrace = {
  -readonly [Key in keyof StudioRunTrace]: StudioRunTrace[Key];
};

type MutableStudioTraceSpan = {
  -readonly [Key in keyof StudioTraceSpan]: StudioTraceSpan[Key];
};

type MutableStudioModelCallTrace = {
  -readonly [Key in keyof StudioModelCallTrace]: StudioModelCallTrace[Key];
};

type MutableStudioToolExecutionTrace = {
  -readonly [Key in keyof StudioToolExecutionTrace]: StudioToolExecutionTrace[Key];
};

type MutableStudioHandoffTrace = {
  -readonly [Key in keyof StudioHandoffTrace]: StudioHandoffTrace[Key];
};

type MutableStudioApprovalTrace = {
  -readonly [Key in keyof StudioApprovalTrace]: StudioApprovalTrace[Key];
};

type MutableStudioMemoryTrace = {
  -readonly [Key in keyof StudioMemoryTrace]: StudioMemoryTrace[Key];
};

type MutableTokenUsage = {
  -readonly [Key in keyof StudioTokenUsage]: StudioTokenUsage[Key];
};

function assignOptional<TObject extends object, TKey extends keyof TObject>(
  target: Partial<TObject>,
  key: TKey,
  value: TObject[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
