import type { Agent } from "../agent/index.js";
import type { EngineContext } from "../runtime/index.js";
import type { JsonValue } from "../shared/index.js";
import type { EngineServices, RunnerOptions } from "./types.js";

/**
 * Builds immutable EngineContext values from Engine services and agent configuration.
 */
export class DefaultEngineContextFactory {
  readonly #services: EngineServices;

  constructor(services: EngineServices) {
    this.#services = Object.freeze({ ...services });
  }

  /**
   * Creates the context made available to one runner.
   */
  create(agent: Agent, options?: RunnerOptions): EngineContext {
    const metadata = mergeMetadata(this.#services.metadata, agent.metadata, options?.metadata);

    const context: Partial<MutableEngineContext> = {
      provider: agent.provider,
    };

    const sessionStore = agent.sessionStore ?? this.#services.sessionStore;
    if (sessionStore !== undefined) {
      context.sessionStore = sessionStore;
    }

    const memory = agent.memory ?? this.#services.memory;
    if (memory !== undefined) {
      context.memory = memory;
    }

    const tracer = agent.tracer ?? this.#services.tracer;
    if (tracer !== undefined) {
      context.tracer = tracer;
    }

    const events = agent.events ?? this.#services.events;
    if (events !== undefined) {
      context.events = events;
    }

    if (metadata !== undefined) {
      context.metadata = metadata;
    }

    return Object.freeze(context) as EngineContext;
  }
}

type MutableEngineContext = {
  -readonly [Key in keyof EngineContext]: EngineContext[Key];
};

function mergeMetadata(
  ...items: readonly (EngineServices["metadata"] | undefined)[]
): EngineServices["metadata"] | undefined {
  const merged: Record<string, JsonValue> = {};

  for (const item of items) {
    if (item !== undefined) {
      for (const [key, value] of Object.entries(item)) {
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? Object.freeze(merged) : undefined;
}
