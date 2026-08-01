import type { Agent } from "../agent/index.js";
import type { ProviderResolver } from "../provider/index.js";
import type { EngineContext } from "../runtime/index.js";
import type { JsonValue } from "../shared/index.js";
import { tool, ToolExecutor, ToolRegistry, type Tool, type ToolSchema } from "../tool/index.js";
import type { JsonObject } from "../shared/index.js";
import type { EngineServices, RunnerOptions } from "./types.js";

/**
 * Builds immutable EngineContext values from Engine services and agent configuration.
 */
export class DefaultEngineContextFactory {
  readonly #services: EngineServices;
  readonly #providerResolver: ProviderResolver;

  constructor(services: EngineServices, providerResolver: ProviderResolver) {
    this.#services = Object.freeze({ ...services });
    this.#providerResolver = providerResolver;
  }

  /**
   * Creates the context made available to one runner.
   */
  create(agent: Agent, options?: RunnerOptions): EngineContext {
    const metadata = mergeMetadata(this.#services.metadata, agent.metadata, options?.metadata);

    const context: Partial<MutableEngineContext> = {
      provider: this.#providerResolver.resolve(agent.provider),
    };

    if (this.#services.approvalManager !== undefined) {
      context.approvalManager = this.#services.approvalManager;
    }
    const tools = new ToolRegistry([
      ...(this.#services.toolRegistry?.list() ?? []),
      ...agent.tools.map((entry) => {
        if (!isAgent(entry)) {
          return entry;
        }

        if (this.#services.agentRegistry?.has(entry.name) !== true) {
          this.#services.agentRegistry?.registerAgent(entry);
        }

        return toAgentTool(entry);
      }),
    ]);

    if (tools.list().length > 0) {
      context.tools = tools;
      context.toolExecutor = this.#services.toolExecutor ?? new ToolExecutor(tools);
    }

    if (this.#services.agentRegistry !== undefined) {
      context.agentRegistry = this.#services.agentRegistry;
    }

    if (this.#services.handoffDepthLimiter !== undefined) {
      context.handoffDepthLimiter = this.#services.handoffDepthLimiter;
    }

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

interface AgentToolInput extends JsonObject {
  readonly input?: string;
}

const agentToolSchema: ToolSchema<AgentToolInput> = Object.freeze({
  parse(input: unknown): AgentToolInput {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return Object.freeze({});
    }

    const value = input as Readonly<Record<string, unknown>>;
    return typeof value.input === "string"
      ? Object.freeze({ input: value.input })
      : Object.freeze({});
  },
  toJSONSchema(): JsonObject {
    return Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({
        input: Object.freeze({
          description: "Optional task or context for the target agent.",
          type: "string",
        }),
      }),
      type: "object",
    });
  },
});

function toAgentTool(agent: Agent): Tool<AgentToolInput> {
  return tool({
    description: `Hand off execution to the ${agent.name} agent.`,
    execute: async (input) => {
      await Promise.resolve();
      return Object.freeze({
        input: input.input ?? "",
        targetAgent: agent.name,
        type: "agent_handoff",
      });
    },
    name: agent.name,
    parameters: agentToolSchema,
  });
}

function isAgent(value: unknown): value is Agent {
  return (
    value instanceof Object && "instructions" in value && "provider" in value && "tools" in value
  );
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
