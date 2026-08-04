/**
 * Wire protocol shared between the Shiro SDK and Studio runtime hub.
 * Keep Studio's `StudioRuntimeEvent` compatible with {@link StudioWireEvent}.
 */

export type StudioWireEventType =
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

export type StudioWireJson =
  | string
  | number
  | boolean
  | null
  | readonly StudioWireJson[]
  | { readonly [key: string]: StudioWireJson };

export interface StudioWirePayload {
  readonly agentName?: string;
  readonly sessionId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly toolName?: string;
  readonly arguments?: Readonly<Record<string, StudioWireJson>>;
  readonly result?: StudioWireJson;
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
  readonly finalStatus?: "running" | "completed" | "failed";
  readonly finalOutput?: StudioWireJson;
  readonly before?: StudioWireJson;
  readonly after?: StudioWireJson;
  readonly memoryDiff?: "inserted" | "modified" | "removed";
  readonly error?: string;
  readonly guardrailName?: string;
  readonly pluginId?: string;
}

export interface StudioWireEvent {
  readonly id: string;
  readonly type: StudioWireEventType;
  readonly offsetMs: number;
  readonly runId: string;
  readonly message?: string;
  readonly terminalKind?:
    "command" | "success" | "event" | "warning" | "muted" | "pink" | "markdown" | "error";
  readonly payload?: StudioWirePayload;
}

export interface StudioRuntimeOptions {
  /** WebSocket URL for the Studio hub. Defaults to SHIRO_STUDIO_URL or ws://127.0.0.1:4317 */
  readonly url?: string;
  /** Display name advertised to Studio. */
  readonly agentName?: string;
}

export type StudioExecuteHandler = (prompt: string) => Promise<unknown>;
