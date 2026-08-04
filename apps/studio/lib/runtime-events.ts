import type { StudioJsonValue, StudioTraceStatus } from "@/lib/trace-utils";

/** Terminal line presentation for the interactive Studio shell. */
export type TerminalLineKind =
  "command" | "success" | "event" | "warning" | "muted" | "pink" | "markdown" | "error";

/**
 * Canonical runtime events. Mock traces and the real SDK should emit the same shapes
 * so Studio panels can subscribe to one stream without special-casing the source.
 */
export type StudioEventType =
  | "run.started"
  | "engine.started"
  | "provider.loading"
  | "provider.connected"
  | "runner.creating"
  | "agent.calling"
  | "agent.start"
  | "prompt.built"
  | "llm.request"
  | "llm.response"
  | "tool.start"
  | "tool.end"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "handoff"
  | "handoff.started"
  | "handoff.completed"
  | "guardrail"
  | "plugin"
  | "approval.requested"
  | "approval.granted"
  | "approval.rejected"
  | "memory.update"
  | "memory.session_loaded"
  | "memory.retrieved"
  | "memory.stored"
  | "memory.compacted"
  | "provider.call.started"
  | "provider.call.completed"
  | "response.streaming"
  | "response.completed"
  | "output"
  | "span.started"
  | "span.ended"
  | "metrics.update"
  | "trace.end"
  | "run.completed"
  | "run.failed"
  | "terminal.line";

export interface StudioRuntimeEvent {
  readonly id: string;
  readonly type: StudioEventType;
  /** Milliseconds from run start — used by the mock replayer for pacing. */
  readonly offsetMs: number;
  readonly runId: string;
  /** Human-readable terminal text. */
  readonly message?: string;
  readonly terminalKind?: TerminalLineKind;
  readonly payload?: StudioEventPayload;
}

export interface StudioEventPayload {
  readonly agentName?: string;
  readonly sessionId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly toolName?: string;
  readonly arguments?: Readonly<Record<string, StudioJsonValue>>;
  readonly result?: StudioJsonValue;
  readonly status?: string;
  readonly durationMs?: number;
  readonly sourceAgent?: string;
  readonly destinationAgent?: string;
  readonly reason?: string;
  readonly decision?: string;
  readonly policy?: string;
  readonly approver?: string;
  readonly kind?: string;
  readonly recordCount?: number;
  readonly messageCount?: number;
  readonly spanId?: string;
  readonly spanName?: string;
  readonly spanCategory?: string;
  readonly finishReason?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCost?: number;
  readonly latencyMs?: number;
  readonly retryNumber?: number;
  readonly markdown?: string;
  readonly finalStatus?: StudioTraceStatus;
  readonly finalOutput?: StudioJsonValue;
  readonly before?: StudioJsonValue;
  readonly after?: StudioJsonValue;
  readonly memoryDiff?: "inserted" | "modified" | "removed";
  readonly error?: string;
  readonly guardrailName?: string;
  readonly pluginId?: string;
}

export interface MockTraceDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly command: string;
  readonly aliases: readonly string[];
  readonly agentName: string;
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly events: readonly StudioRuntimeEvent[];
}

export interface TerminalLine {
  readonly id: string;
  readonly kind: TerminalLineKind;
  readonly text: string;
  readonly markdown?: string;
}

export type RuntimeStatus = "idle" | "running" | "completed" | "failed";

export interface RuntimeMetrics {
  readonly tokens: number;
  readonly cost: number;
  readonly providerLatencyMs: number;
  readonly toolLatencyMs: number;
  readonly handoffs: number;
  readonly tools: number;
  readonly approvals: number;
  readonly elapsedMs: number;
}
