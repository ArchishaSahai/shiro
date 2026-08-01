import type { EventBus } from "../events/index.js";
import type { AgentRegistry, HandoffDepthLimiter } from "../handoff/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Provider } from "../provider/index.js";
import type { SessionStore } from "../session/index.js";
import type { Metadata } from "../shared/index.js";
import type { ToolExecutor, ToolRegistry } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";

/**
 * Long-lived services available to Shiro orchestration.
 */
export interface EngineContext {
  readonly provider: Provider;
  readonly tools?: ToolRegistry;
  readonly toolExecutor?: ToolExecutor;
  readonly agentRegistry?: AgentRegistry;
  readonly handoffDepthLimiter?: HandoffDepthLimiter;
  readonly sessionStore?: SessionStore;
  readonly memory?: MemoryProvider;
  readonly tracer?: Tracer;
  readonly events?: EventBus;
  readonly metadata?: Metadata;
}

/**
 * Compatibility alias for earlier public contracts. Prefer EngineContext in new code.
 */
export type RuntimeContext = EngineContext;

/**
 * Per-execution context shared across lifecycle hooks.
 */
export interface RunContext {
  readonly runId: string;
  readonly agentName: string;
  readonly sessionId?: string;
  readonly maxIterations?: number;
  readonly engine: EngineContext;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}
