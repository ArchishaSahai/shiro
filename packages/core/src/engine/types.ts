import type { Agent } from "../agent/index.js";
import type { EventBus } from "../events/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Provider } from "../provider/index.js";
import type { EngineContext, RunContext } from "../runtime/index.js";
import type { SessionStore } from "../session/index.js";
import type { Message, Metadata } from "../shared/index.js";
import type { Tracer } from "../tracing/index.js";
import type { EngineState, RunnerState } from "./lifecycle.js";

/**
 * Input accepted by the execution infrastructure.
 */
export type RunInput = string | Message;

/**
 * Long-lived services owned by an Engine.
 */
export interface EngineServices {
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
  readonly context: RunContext;
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
