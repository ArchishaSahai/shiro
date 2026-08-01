import type { Disposable, EventBus, EventHandler, ShiroEvent } from "../events/index.js";
import { ShiroEventType } from "../events/index.js";
import type { ShiroError } from "../errors/index.js";
import type { JsonValue, Metadata } from "../shared/index.js";
import { ToolExecutionState } from "../tool/index.js";

/**
 * Attributes attached to a trace span.
 */
export type TraceAttributes = Metadata;

/**
 * Terminal status of a run trace.
 */
export enum TraceStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

/**
 * Lifecycle status of one trace span.
 */
export enum TraceSpanStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  TimedOut = "timed_out",
}

/**
 * High-level span categories understood by Shiro observability consumers.
 */
export enum TraceSpanCategory {
  Provider = "provider",
  Tool = "tool",
  Memory = "memory",
  Session = "session",
  Handoff = "handoff",
  Approval = "approval",
  OutputValidation = "output_validation",
  OutputRepair = "output_repair",
  Run = "run",
}

/**
 * Provider-independent token and cost accounting.
 */
export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCost?: number;
}

/**
 * Immutable event recorded inside a trace timeline.
 */
export interface TraceEvent {
  readonly eventId: string;
  readonly runId: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly metadata?: Metadata;
}

/**
 * Immutable span recorded for one operation inside a run.
 */
export interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly category: TraceSpanCategory;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly durationMs?: number;
  readonly status: TraceSpanStatus;
  readonly metadata?: Metadata;
}

/**
 * Active span handle used by custom tracing integrations.
 */
export interface TraceSpanHandle {
  readonly id: string;
  setAttribute(key: string, value: TraceAttributes[string]): void;
  recordError(error: unknown): void;
  end(): void;
}

/**
 * Observability integration for custom instrumentation.
 */
export interface Tracer {
  startSpan(name: string, attributes?: TraceAttributes): TraceSpanHandle;
}

/**
 * One provider invocation captured during a run.
 */
export interface ModelCallTrace {
  readonly providerName: string;
  readonly model?: string;
  readonly requestTimestamp: Date;
  readonly responseTimestamp?: Date;
  readonly latencyMs?: number;
  readonly retryNumber?: number;
  readonly finishReason?: string;
  readonly tokenUsage?: TokenUsage;
}

/**
 * One tool execution captured during a run.
 */
export interface ToolExecutionTrace {
  readonly toolName: string;
  readonly arguments?: Metadata;
  readonly durationMs?: number;
  readonly status: TraceSpanStatus;
  readonly serializedResult?: JsonValue;
}

/**
 * One agent handoff captured during a run.
 */
export interface HandoffTrace {
  readonly sourceAgent: string;
  readonly destinationAgent: string;
  readonly timestamp: Date;
  readonly reason?: string;
  readonly durationMs?: number;
}

/**
 * One human approval interaction captured during a run.
 */
export interface ApprovalTrace {
  readonly toolName: string;
  readonly timestamp: Date;
  readonly decision?: string;
  readonly policy?: string;
  readonly timeoutMs?: number;
  readonly approver?: string;
  readonly durationMs?: number;
}

/**
 * Memory and session activity captured during a run.
 */
export interface MemoryTrace {
  readonly kind: "retrieved" | "stored" | "compacted" | "session_loaded" | "session_saved";
  readonly timestamp: Date;
  readonly recordCount?: number;
  readonly messageCount?: number;
  readonly sessionId?: string;
}

/**
 * Ordered trace activity for one run.
 */
export interface TraceTimeline {
  readonly events: readonly TraceEvent[];
  readonly spans: readonly TraceSpan[];
}

/**
 * Complete immutable trace for one agent run.
 */
export interface RunTrace {
  readonly runId: string;
  readonly sessionId?: string;
  readonly agentId?: string;
  readonly agentName?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly totalDurationMs?: number;
  readonly finalStatus: TraceStatus;
  readonly finalOutput?: JsonValue;
  readonly totalIterations: number;
  readonly tokenUsage?: TokenUsage;
  readonly modelCalls: readonly ModelCallTrace[];
  readonly toolExecutions: readonly ToolExecutionTrace[];
  readonly handoffs: readonly HandoffTrace[];
  readonly approvals: readonly ApprovalTrace[];
  readonly memory: readonly MemoryTrace[];
  readonly timeline: TraceTimeline;
  readonly metadata?: Metadata;
}

/**
 * Serializable point-in-time trace snapshot.
 */
export interface TraceSnapshot {
  readonly traces: readonly RunTrace[];
  readonly statistics: TraceStatistics;
  readonly createdAt: Date;
}

/**
 * Query used when listing traces.
 */
export interface TraceFilter {
  readonly runId?: string;
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly status?: TraceStatus;
  readonly since?: Date;
  readonly until?: Date;
}

/**
 * Aggregate trace statistics.
 */
export interface TraceStatistics {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly failedRuns: number;
  readonly averageDurationMs?: number;
  readonly totalProviderCalls: number;
  readonly totalToolExecutions: number;
  readonly totalHandoffs: number;
  readonly totalApprovals: number;
  readonly tokenUsage?: TokenUsage;
}

/**
 * Persistence boundary for run traces.
 */
export interface TraceStore {
  save(trace: RunTrace): void | Promise<void>;
  get(runId: string): RunTrace | undefined | Promise<RunTrace | undefined>;
  list(filter?: TraceFilter): readonly RunTrace[] | Promise<readonly RunTrace[]>;
  delete(runId: string): boolean | Promise<boolean>;
  clear(): void | Promise<void>;
}

/**
 * Exporter boundary for trace integrations.
 */
export interface TraceExporter {
  export(snapshot: TraceSnapshot): undefined | string | Promise<undefined | string>;
}

/**
 * In-memory trace persistence for local development, tests, and Studio previews.
 */
export class InMemoryTraceStore implements TraceStore {
  readonly #traces = new Map<string, RunTrace>();

  save(trace: RunTrace): void {
    this.#traces.set(trace.runId, freezeRunTrace(trace));
  }

  get(runId: string): RunTrace | undefined {
    return this.#traces.get(runId);
  }

  list(filter: TraceFilter = {}): readonly RunTrace[] {
    return Object.freeze(
      [...this.#traces.values()].filter((trace) => matchesFilter(trace, filter))
    );
  }

  delete(runId: string): boolean {
    return this.#traces.delete(runId);
  }

  clear(): void {
    this.#traces.clear();
  }
}

/**
 * JSON trace exporter.
 */
export class JsonTraceExporter implements TraceExporter {
  export(snapshot: TraceSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }
}

/**
 * Console trace exporter for local debugging.
 */
export class ConsoleTraceExporter implements TraceExporter {
  export(snapshot: TraceSnapshot): undefined {
    for (const trace of snapshot.traces) {
      console.log(
        `[shiro:trace] ${trace.runId} ${trace.finalStatus} ` +
          `${String(trace.totalDurationMs ?? 0)}ms spans=${String(trace.timeline.spans.length)}`
      );
    }
  }
}

/**
 * Builds and stores run traces from Shiro lifecycle events.
 */
export class TraceManager implements EventBus {
  readonly #store: TraceStore;
  readonly #downstream: EventBus | undefined;
  readonly #handlers = new Map<ShiroEventType, Set<EventHandler<ShiroEventType>>>();
  readonly #builders = new Map<string, TraceBuilder>();
  readonly #openSpans = new Map<string, Map<string, TraceSpan>>();

  constructor(config: TraceManagerConfig = {}) {
    this.#store = config.store ?? new InMemoryTraceStore();
    this.#downstream = config.events;
  }

  /** Trace store owned by this manager. */
  get store(): TraceStore {
    return this.#store;
  }

  /**
   * Consumes Shiro lifecycle events and publishes them to subscribers.
   */
  async publish(event: ShiroEvent): Promise<void> {
    await this.#record(event);
    await this.#notify(event);
    await this.#downstream?.publish(event);
  }

  /**
   * Subscribes to Shiro and trace lifecycle events.
   */
  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable {
    const handlers = this.#handlers.get(type) ?? new Set<EventHandler<ShiroEventType>>();
    handlers.add(handler as unknown as EventHandler<ShiroEventType>);
    this.#handlers.set(type, handlers);

    return Object.freeze({
      dispose: () => {
        handlers.delete(handler as unknown as EventHandler<ShiroEventType>);
      },
    });
  }

  /**
   * Returns one stored trace.
   */
  get(runId: string): RunTrace | undefined | Promise<RunTrace | undefined> {
    return this.#store.get(runId);
  }

  /**
   * Lists stored traces.
   */
  list(filter?: TraceFilter): readonly RunTrace[] | Promise<readonly RunTrace[]> {
    return this.#store.list(filter);
  }

  /**
   * Creates a snapshot for exporting or Studio consumption.
   */
  async snapshot(filter?: TraceFilter): Promise<TraceSnapshot> {
    const traces = await this.#store.list(filter);
    return Object.freeze({
      createdAt: new Date(),
      statistics: calculateStatistics(traces),
      traces,
    });
  }

  /**
   * Exports the current snapshot through a configured exporter.
   */
  async export(exporter: TraceExporter, filter?: TraceFilter): Promise<undefined | string> {
    const snapshot = await this.snapshot(filter);
    const result = await exporter.export(snapshot);

    for (const trace of snapshot.traces) {
      await this.#emit({
        runId: trace.runId,
        timestamp: new Date(),
        type: ShiroEventType.TraceExported,
      });
    }

    return result;
  }

  async #record(event: ShiroEvent): Promise<void> {
    if (isTraceManagerEvent(event.type)) {
      return;
    }

    let builder = this.#builders.get(event.runId);

    if (builder === undefined && event.type === ShiroEventType.RunStarted) {
      builder = new TraceBuilder(event);
      this.#builders.set(event.runId, builder);
      this.#openSpans.set(event.runId, new Map());
      await this.#store.save(builder.snapshot());
      await this.#emit({
        runId: event.runId,
        timestamp: event.timestamp,
        type: ShiroEventType.TraceStarted,
      });
    }

    if (builder === undefined) {
      return;
    }

    const completedSpan = this.#applyEvent(builder, event);
    const trace = builder.snapshot();
    await this.#store.save(trace);
    await this.#emit({
      runId: event.runId,
      timestamp: event.timestamp,
      type: ShiroEventType.TraceUpdated,
    });

    if (completedSpan !== undefined) {
      await this.#emit({
        runId: event.runId,
        spanId: completedSpan.spanId,
        timestamp: event.timestamp,
        type: ShiroEventType.SpanCompleted,
      });
    }

    if (event.type === ShiroEventType.RunCompleted || event.type === ShiroEventType.RunFailed) {
      await this.#emit({
        runId: event.runId,
        timestamp: event.timestamp,
        type: ShiroEventType.TraceCompleted,
      });
    }
  }

  #applyEvent(builder: TraceBuilder, event: ShiroEvent): TraceSpan | undefined {
    builder.addEvent(event);

    if (event.type === ShiroEventType.AgentStarted) {
      builder.setAgent(event.agentName);
      return undefined;
    }

    if (event.type === ShiroEventType.ProviderStarted) {
      builder.incrementIterations();
      builder.setProvider(event.providerName);
      void this.#startSpan(event.runId, "provider", "Provider Call", TraceSpanCategory.Provider, {
        providerName: event.providerName,
      });
      builder.addModelCall(event.providerName, event.timestamp);
      return undefined;
    }

    if (event.type === ShiroEventType.ProviderFinished) {
      const span = this.#completeSpan(
        event.runId,
        "provider",
        TraceSpanStatus.Completed,
        event.timestamp
      );
      builder.completeModelCall(event.timestamp);
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    if (event.type === ShiroEventType.ToolStarted) {
      const key = `tool:${event.toolCall.id ?? event.toolCall.name}`;
      void this.#startSpan(event.runId, key, event.toolCall.name, TraceSpanCategory.Tool, {
        toolName: event.toolCall.name,
      });
      return undefined;
    }

    if (
      event.type === ShiroEventType.ToolCompleted ||
      event.type === ShiroEventType.ToolFailed ||
      event.type === ShiroEventType.ToolTimedOut
    ) {
      const key = `tool:${event.result.toolCallId ?? event.result.name}`;
      const status = toToolSpanStatus(event.result.state);
      const span = this.#completeSpan(event.runId, key, status, event.timestamp);
      builder.addToolExecution(event.result, status);
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    return this.#applyDomainEvent(builder, event);
  }

  #applyDomainEvent(builder: TraceBuilder, event: ShiroEvent): TraceSpan | undefined {
    if (
      event.type === ShiroEventType.SessionCreated ||
      event.type === ShiroEventType.SessionLoaded
    ) {
      builder.setSession(event.sessionId);
      const span = createCompletedSpan(event, "Session Load", TraceSpanCategory.Session, {
        sessionId: event.sessionId,
      });
      builder.addMemory({
        kind: "session_loaded",
        sessionId: event.sessionId,
        timestamp: event.timestamp,
      });
      builder.addSpan(span);
      return span;
    }

    if (event.type === ShiroEventType.SessionUpdated) {
      const span = createCompletedSpan(event, "Session Save", TraceSpanCategory.Session, {
        sessionId: event.sessionId,
      });
      builder.addMemory({
        kind: "session_saved",
        sessionId: event.sessionId,
        timestamp: event.timestamp,
      });
      builder.addSpan(span);
      return span;
    }

    if (event.type === ShiroEventType.MemoryRetrieved) {
      const span = createCompletedSpan(event, "Memory Retrieval", TraceSpanCategory.Memory, {
        recordCount: event.recordCount,
      });
      builder.addMemory({
        kind: "retrieved",
        recordCount: event.recordCount,
        timestamp: event.timestamp,
      });
      builder.addSpan(span);
      return span;
    }

    if (event.type === ShiroEventType.MemoryStored) {
      const span = createCompletedSpan(event, "Memory Persistence", TraceSpanCategory.Memory, {
        recordCount: event.recordCount,
      });
      builder.addMemory({
        kind: "stored",
        recordCount: event.recordCount,
        timestamp: event.timestamp,
      });
      builder.addSpan(span);
      return span;
    }

    if (event.type === ShiroEventType.MemoryCompacted) {
      const span = createCompletedSpan(event, "Memory Compaction", TraceSpanCategory.Memory, {
        messageCount: event.messageCount,
      });
      builder.addMemory({
        kind: "compacted",
        messageCount: event.messageCount,
        timestamp: event.timestamp,
      });
      builder.addSpan(span);
      return span;
    }

    return this.#applyCoordinationEvent(builder, event);
  }

  #applyCoordinationEvent(builder: TraceBuilder, event: ShiroEvent): TraceSpan | undefined {
    if (event.type === ShiroEventType.AgentHandoffStarted) {
      void this.#startSpan(event.runId, "handoff", "Agent Handoff", TraceSpanCategory.Handoff, {
        fromAgent: event.fromAgent,
        toAgent: event.toAgent,
      });
      builder.addHandoff(event.fromAgent, event.toAgent, event.timestamp);
      return undefined;
    }

    if (
      event.type === ShiroEventType.AgentHandoffCompleted ||
      event.type === ShiroEventType.AgentHandoffFailed
    ) {
      const span = this.#completeSpan(
        event.runId,
        "handoff",
        event.type === ShiroEventType.AgentHandoffCompleted
          ? TraceSpanStatus.Completed
          : TraceSpanStatus.Failed,
        event.timestamp
      );
      builder.completeHandoff(event.timestamp);
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    if (event.type === ShiroEventType.ApprovalRequested) {
      const key = `approval:${event.toolCall.id ?? event.toolCall.name}`;
      void this.#startSpan(event.runId, key, "Approval Request", TraceSpanCategory.Approval, {
        toolName: event.toolCall.name,
      });
      builder.addApproval(event.toolCall.name, event.timestamp);
      return undefined;
    }

    if (
      event.type === ShiroEventType.ApprovalGranted ||
      event.type === ShiroEventType.ApprovalRejected ||
      event.type === ShiroEventType.ApprovalTimedOut ||
      event.type === ShiroEventType.ApprovalCancelled
    ) {
      const key = `approval:${event.toolCall.id ?? event.toolCall.name}`;
      const span = this.#completeSpan(
        event.runId,
        key,
        toApprovalSpanStatus(event.type),
        event.timestamp
      );
      builder.completeApproval(event.toolCall.name, event.type, event.timestamp);
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    return this.#applyOutputEvent(builder, event);
  }

  #applyOutputEvent(builder: TraceBuilder, event: ShiroEvent): TraceSpan | undefined {
    if (event.type === ShiroEventType.OutputValidationStarted) {
      void this.#startSpan(
        event.runId,
        `output_validation:${String(event.attempt)}`,
        "Structured Output Validation",
        TraceSpanCategory.OutputValidation,
        { attempt: event.attempt }
      );
      return undefined;
    }

    if (
      event.type === ShiroEventType.OutputValidationSucceeded ||
      event.type === ShiroEventType.OutputValidationFailed
    ) {
      const span = this.#completeSpan(
        event.runId,
        `output_validation:${String(event.attempt)}`,
        event.type === ShiroEventType.OutputValidationSucceeded
          ? TraceSpanStatus.Completed
          : TraceSpanStatus.Failed,
        event.timestamp
      );
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    if (event.type === ShiroEventType.OutputRepairStarted) {
      void this.#startSpan(
        event.runId,
        `output_repair:${String(event.attempt)}`,
        "Output Repair",
        TraceSpanCategory.OutputRepair,
        { attempt: event.attempt, issueCount: event.issueCount }
      );
      return undefined;
    }

    if (
      event.type === ShiroEventType.OutputRepairCompleted ||
      event.type === ShiroEventType.OutputRepairFailed
    ) {
      const span = this.#completeSpan(
        event.runId,
        `output_repair:${String(event.attempt)}`,
        event.type === ShiroEventType.OutputRepairCompleted
          ? TraceSpanStatus.Completed
          : TraceSpanStatus.Failed,
        event.timestamp
      );
      if (span !== undefined) {
        builder.addSpan(span);
      }
      return span;
    }

    if (event.type === ShiroEventType.RunCompleted) {
      builder.complete(TraceStatus.Completed, event.timestamp);
      return undefined;
    }

    if (event.type === ShiroEventType.RunFailed) {
      builder.fail(event.error, event.timestamp);
      return undefined;
    }

    return undefined;
  }

  async #startSpan(
    runId: string,
    key: string,
    name: string,
    category: TraceSpanCategory,
    metadata?: Metadata
  ): Promise<void> {
    const spans = this.#openSpans.get(runId);

    if (spans === undefined) {
      return;
    }

    const span = createSpan(name, category, metadata);
    spans.set(key, span);
    await this.#emit({
      runId,
      spanId: span.spanId,
      timestamp: span.startTime,
      type: ShiroEventType.SpanStarted,
    });
  }

  #completeSpan(
    runId: string,
    key: string,
    status: TraceSpanStatus,
    endTime: Date
  ): TraceSpan | undefined {
    const spans = this.#openSpans.get(runId);
    const span = spans?.get(key);

    if (span === undefined) {
      return undefined;
    }

    spans?.delete(key);
    return completeSpan(span, status, endTime);
  }

  async #notify(event: ShiroEvent): Promise<void> {
    const handlers = this.#handlers.get(event.type);

    if (handlers === undefined) {
      return;
    }

    await Promise.all([...handlers].map(async (handler) => handler(event)));
  }

  async #emit(event: ShiroEvent): Promise<void> {
    await this.#notify(event);
    await this.#downstream?.publish(event);
  }
}

/**
 * TraceManager dependencies.
 */
export interface TraceManagerConfig {
  readonly store?: TraceStore;
  readonly events?: EventBus;
}

class TraceBuilder {
  readonly #runId: string;
  readonly #startTime: Date;
  readonly #metadata: Metadata | undefined;
  #sessionId: string | undefined;
  #agentName: string | undefined;
  #provider: string | undefined;
  #endTime: Date | undefined;
  #status = TraceStatus.Running;
  #error: ShiroError | undefined;
  #iterations = 0;
  #events: TraceEvent[] = [];
  #spans: TraceSpan[] = [];
  #modelCalls: ModelCallTrace[] = [];
  #tools: ToolExecutionTrace[] = [];
  #handoffs: HandoffTrace[] = [];
  #approvals: ApprovalTrace[] = [];
  #memory: MemoryTrace[] = [];

  constructor(event: ShiroEvent) {
    this.#runId = event.runId;
    this.#startTime = event.timestamp;
    this.#metadata = event.metadata;
  }

  setAgent(agentName: string): void {
    this.#agentName = agentName;
  }

  setSession(sessionId: string): void {
    this.#sessionId = sessionId;
  }

  setProvider(provider: string): void {
    this.#provider = provider;
  }

  incrementIterations(): void {
    this.#iterations += 1;
  }

  addEvent(event: ShiroEvent): void {
    const traceEvent: Partial<MutableTraceEvent> = {
      eventId: createTraceId("event"),
      runId: event.runId,
      timestamp: event.timestamp,
      type: event.type,
    };

    if (event.metadata !== undefined) {
      traceEvent.metadata = event.metadata;
    }

    this.#events.push(Object.freeze(traceEvent) as TraceEvent);
  }

  addSpan(span: TraceSpan): void {
    this.#spans.push(span);
  }

  addModelCall(providerName: string, timestamp: Date): void {
    this.#modelCalls.push(
      Object.freeze({
        providerName,
        requestTimestamp: timestamp,
      })
    );
  }

  completeModelCall(timestamp: Date): void {
    const latest = this.#modelCalls.at(-1);

    if (latest === undefined || latest.responseTimestamp !== undefined) {
      return;
    }

    this.#modelCalls[this.#modelCalls.length - 1] = Object.freeze({
      ...latest,
      latencyMs: timestamp.getTime() - latest.requestTimestamp.getTime(),
      responseTimestamp: timestamp,
    });
  }

  addToolExecution(
    result: { readonly name: string; readonly output: JsonValue; readonly durationMs: number },
    status: TraceSpanStatus
  ): void {
    this.#tools.push(
      Object.freeze({
        durationMs: result.durationMs,
        serializedResult: result.output,
        status,
        toolName: result.name,
      })
    );
  }

  addHandoff(sourceAgent: string, destinationAgent: string, timestamp: Date): void {
    this.#handoffs.push(
      Object.freeze({
        destinationAgent,
        sourceAgent,
        timestamp,
      })
    );
  }

  completeHandoff(timestamp: Date): void {
    const latest = this.#handoffs.at(-1);

    if (latest === undefined || latest.durationMs !== undefined) {
      return;
    }

    this.#handoffs[this.#handoffs.length - 1] = Object.freeze({
      ...latest,
      durationMs: timestamp.getTime() - latest.timestamp.getTime(),
    });
  }

  addApproval(toolName: string, timestamp: Date): void {
    this.#approvals.push(
      Object.freeze({
        timestamp,
        toolName,
      })
    );
  }

  completeApproval(toolName: string, decision: string, timestamp: Date): void {
    const index = this.#approvals.findLastIndex(
      (approval) => approval.toolName === toolName && approval.decision === undefined
    );

    if (index < 0) {
      return;
    }

    const approval = this.#approvals[index];

    if (approval === undefined) {
      return;
    }

    this.#approvals[index] = Object.freeze({
      ...approval,
      decision,
      durationMs: timestamp.getTime() - approval.timestamp.getTime(),
    });
  }

  addMemory(memory: MemoryTrace): void {
    this.#memory.push(freezeMemoryTrace(memory));
  }

  complete(status: TraceStatus, timestamp: Date): void {
    this.#status = status;
    this.#endTime = timestamp;
  }

  fail(error: ShiroError, timestamp: Date): void {
    this.#status = TraceStatus.Failed;
    this.#error = error;
    this.#endTime = timestamp;
  }

  snapshot(): RunTrace {
    const trace: Partial<MutableRunTrace> = {
      finalStatus: this.#status,
      handoffs: Object.freeze([...this.#handoffs]),
      memory: Object.freeze([...this.#memory]),
      modelCalls: Object.freeze([...this.#modelCalls]),
      approvals: Object.freeze([...this.#approvals]),
      runId: this.#runId,
      startTime: this.#startTime,
      timeline: Object.freeze({
        events: Object.freeze([...this.#events]),
        spans: Object.freeze([...this.#spans]),
      }),
      toolExecutions: Object.freeze([...this.#tools]),
      totalIterations: this.#iterations,
    };

    if (this.#sessionId !== undefined) {
      trace.sessionId = this.#sessionId;
    }

    if (this.#agentName !== undefined) {
      trace.agentName = this.#agentName;
    }

    if (this.#provider !== undefined) {
      trace.provider = this.#provider;
    }

    if (this.#endTime !== undefined) {
      trace.endTime = this.#endTime;
      trace.totalDurationMs = this.#endTime.getTime() - this.#startTime.getTime();
    }

    if (this.#metadata !== undefined) {
      trace.metadata = this.#metadata;
    }

    if (this.#error !== undefined) {
      trace.metadata = Object.freeze({
        ...(trace.metadata ?? {}),
        error: this.#error.message,
      });
    }

    return freezeRunTrace(trace as RunTrace);
  }
}

type MutableRunTrace = {
  -readonly [Key in keyof RunTrace]: RunTrace[Key];
};

function createSpan(
  name: string,
  category: TraceSpanCategory,
  metadata: Metadata | undefined
): TraceSpan {
  const span: Partial<MutableTraceSpan> = {
    category,
    name,
    spanId: createTraceId("span"),
    startTime: new Date(),
    status: TraceSpanStatus.Running,
  };

  if (metadata !== undefined) {
    span.metadata = metadata;
  }

  return Object.freeze(span) as TraceSpan;
}

function createCompletedSpan(
  event: ShiroEvent,
  name: string,
  category: TraceSpanCategory,
  metadata?: Metadata
): TraceSpan {
  return completeSpan(
    {
      category,
      metadata,
      name,
      spanId: createTraceId("span"),
      startTime: event.timestamp,
      status: TraceSpanStatus.Running,
    } as TraceSpan,
    TraceSpanStatus.Completed,
    event.timestamp
  );
}

type MutableTraceSpan = {
  -readonly [Key in keyof TraceSpan]: TraceSpan[Key];
};

function completeSpan(span: TraceSpan, status: TraceSpanStatus, endTime: Date): TraceSpan {
  return Object.freeze({
    ...span,
    durationMs: endTime.getTime() - span.startTime.getTime(),
    endTime,
    status,
  });
}

function toToolSpanStatus(state: ToolExecutionState): TraceSpanStatus {
  if (state === ToolExecutionState.Completed) {
    return TraceSpanStatus.Completed;
  }

  if (state === ToolExecutionState.TimedOut) {
    return TraceSpanStatus.TimedOut;
  }

  if (state === ToolExecutionState.Cancelled) {
    return TraceSpanStatus.Cancelled;
  }

  return TraceSpanStatus.Failed;
}

function toApprovalSpanStatus(type: ShiroEventType): TraceSpanStatus {
  if (type === ShiroEventType.ApprovalGranted) {
    return TraceSpanStatus.Completed;
  }

  if (type === ShiroEventType.ApprovalTimedOut) {
    return TraceSpanStatus.TimedOut;
  }

  if (type === ShiroEventType.ApprovalCancelled) {
    return TraceSpanStatus.Cancelled;
  }

  return TraceSpanStatus.Failed;
}

function freezeRunTrace(trace: RunTrace): RunTrace {
  return Object.freeze({
    ...trace,
    approvals: Object.freeze([...trace.approvals]),
    handoffs: Object.freeze([...trace.handoffs]),
    memory: Object.freeze([...trace.memory]),
    modelCalls: Object.freeze([...trace.modelCalls]),
    timeline: Object.freeze({
      events: Object.freeze([...trace.timeline.events]),
      spans: Object.freeze([...trace.timeline.spans]),
    }),
    toolExecutions: Object.freeze([...trace.toolExecutions]),
  });
}

function freezeMemoryTrace(memory: MemoryTrace): MemoryTrace {
  return Object.freeze({ ...memory });
}

function matchesFilter(trace: RunTrace, filter: TraceFilter): boolean {
  if (filter.runId !== undefined && trace.runId !== filter.runId) {
    return false;
  }

  if (filter.sessionId !== undefined && trace.sessionId !== filter.sessionId) {
    return false;
  }

  if (filter.agentName !== undefined && trace.agentName !== filter.agentName) {
    return false;
  }

  if (filter.status !== undefined && trace.finalStatus !== filter.status) {
    return false;
  }

  if (filter.since !== undefined && trace.startTime < filter.since) {
    return false;
  }

  return !(filter.until !== undefined && trace.startTime > filter.until);
}

function calculateStatistics(traces: readonly RunTrace[]): TraceStatistics {
  const completed = traces.filter((trace) => trace.finalStatus === TraceStatus.Completed);
  const failed = traces.filter((trace) => trace.finalStatus === TraceStatus.Failed);
  const durations = traces.flatMap((trace) =>
    trace.totalDurationMs === undefined ? [] : [trace.totalDurationMs]
  );
  const totalDuration = durations.reduce((sum, value) => sum + value, 0);

  const statistics: Partial<MutableTraceStatistics> = {
    completedRuns: completed.length,
    failedRuns: failed.length,
    totalApprovals: traces.reduce((sum, trace) => sum + trace.approvals.length, 0),
    totalHandoffs: traces.reduce((sum, trace) => sum + trace.handoffs.length, 0),
    totalProviderCalls: traces.reduce((sum, trace) => sum + trace.modelCalls.length, 0),
    totalRuns: traces.length,
    totalToolExecutions: traces.reduce((sum, trace) => sum + trace.toolExecutions.length, 0),
  };

  if (durations.length > 0) {
    statistics.averageDurationMs = totalDuration / durations.length;
  }

  return Object.freeze(statistics) as TraceStatistics;
}

type MutableTraceEvent = {
  -readonly [Key in keyof TraceEvent]: TraceEvent[Key];
};

type MutableTraceStatistics = {
  -readonly [Key in keyof TraceStatistics]: TraceStatistics[Key];
};

function createTraceId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isTraceManagerEvent(type: ShiroEventType): boolean {
  return (
    type === ShiroEventType.TraceStarted ||
    type === ShiroEventType.TraceUpdated ||
    type === ShiroEventType.SpanStarted ||
    type === ShiroEventType.SpanCompleted ||
    type === ShiroEventType.TraceCompleted ||
    type === ShiroEventType.TraceExported
  );
}
