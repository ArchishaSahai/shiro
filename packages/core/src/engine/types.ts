import type { Agent, RunResult } from "../agent/index.js";
import type { EventBus } from "../events/index.js";
import type { AgentRegistry, HandoffDepthLimiter } from "../handoff/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { PluginManager, PluginManagerConfig } from "../plugin/index.js";
import type { Provider, ProviderRegistry, ProviderResolver } from "../provider/index.js";
import type { EngineContext, RunContext } from "../runtime/index.js";
import type { SessionStore } from "../session/index.js";
import type { Message, Metadata } from "../shared/index.js";
import type { ToolExecutor, ToolRegistry } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";
import type { EngineState, PipelineStage, RunnerState } from "./lifecycle.js";

/**
 * Input accepted by the execution infrastructure.
 */
export type RunInput = string | Message;

/**
 * Long-lived services owned by an Engine.
 */
export interface EngineServices {
  readonly pluginManager?: PluginManager;
  readonly plugins?: PluginManagerConfig;
  readonly providerRegistry?: ProviderRegistry;
  readonly providerResolver?: ProviderResolver;
  readonly toolRegistry?: ToolRegistry;
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
 * Immutable Engine configuration.
 */
export interface EngineConfig extends EngineServices {
  readonly id?: string;
}

/**
 * Options used when creating a runner.
 */
export interface RunnerOptions {
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly maxIterations?: number;
  readonly metadata?: Metadata;
}

/**
 * Immutable dependencies injected into a Runner.
 */
export interface RunnerDependencies {
  readonly agent: Agent;
  readonly input: RunInput;
  readonly context: RunContext;
}

/**
 * Read-only snapshot of Engine lifecycle state.
 */
export interface EngineSnapshot {
  readonly id: string;
  readonly state: EngineState;
}

/**
 * Read-only snapshot of Runner lifecycle state.
 */
export interface RunnerSnapshot {
  readonly runId: string;
  readonly state: RunnerState;
  readonly stage: PipelineStage;
  readonly context: RunContext;
}

/**
 * Internal output of the execution pipeline.
 */
export interface PipelineResult {
  readonly result: RunResult;
}

/**
 * Creates the provider-aware EngineContext for one agent run.
 */
export interface EngineContextFactory {
  create(agent: Agent, options?: RunnerOptions): EngineContext;
}

/**
 * Provider selected for a specific agent run.
 */
export interface AgentProviderResolver {
  resolve(agent: Agent): Provider;
}
