import type { ApprovalManager } from "../approval/index.js";
import type { EventBus } from "../events/index.js";
import type { AgentRegistry, HandoffDepthLimiter } from "../handoff/index.js";
import type { ContextCompactor, MemoryManager, MemoryProvider } from "../memory/index.js";
import type { StructuredOutputManager } from "../output/index.js";
import type { Provider } from "../provider/index.js";
import type { SessionManager, SessionStore } from "../session/index.js";
import type { Metadata } from "../shared/index.js";
import type { ToolExecutor, ToolRegistry } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";

/**
 * Long-lived services available to Shiro orchestration.
 */
export interface EngineContext {
  readonly provider: Provider;
  readonly approvalManager?: ApprovalManager;
  readonly tools?: ToolRegistry;
  readonly toolExecutor?: ToolExecutor;
  readonly agentRegistry?: AgentRegistry;
  readonly handoffDepthLimiter?: HandoffDepthLimiter;
  readonly sessionManager?: SessionManager;
  readonly sessionStore?: SessionStore;
  readonly memoryManager?: MemoryManager;
  readonly memory?: MemoryProvider;
  readonly contextCompactor?: ContextCompactor;
  readonly structuredOutputManager?: StructuredOutputManager;
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
