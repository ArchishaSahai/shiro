import type { HumanApproval } from "../approval/index.js";
import type { EventBus } from "../events/index.js";
import type { Guardrail } from "../guardrails/index.js";
import type { HandoffStrategy } from "../handoff/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Middleware } from "../middleware/index.js";
import type { Provider } from "../provider/index.js";
import type { SessionStore } from "../session/index.js";
import type { Metadata } from "../shared/index.js";
import type { Tracer } from "../tracing/index.js";
import { Agent, type AgentConfig, type AgentTool } from "./agent.js";
import { validateAgentConfig } from "./validation.js";

type MutableAgentConfig = {
  -readonly [Key in keyof AgentConfig]: AgentConfig[Key];
};

/**
 * Fluent builder for composing an immutable Agent configuration.
 */
export class AgentBuilder {
  #name: string | undefined;
  #instructions: string | undefined;
  #provider: Provider | string | undefined;
  #tools: AgentTool[] = [];
  #guardrails: Guardrail[] = [];
  #middleware: Middleware[] = [];
  #memory: MemoryProvider | undefined;
  #sessionStore: SessionStore | undefined;
  #tracer: Tracer | undefined;
  #events: EventBus | undefined;
  #humanApproval: HumanApproval | undefined;
  #handoff: HandoffStrategy | undefined;
  #metadata: Metadata | undefined;

  /** Sets the agent name. */
  name(name: string): this {
    this.#name = name;
    return this;
  }

  /** Sets the agent instructions. */
  instructions(instructions: string): this {
    this.#instructions = instructions;
    return this;
  }

  /** Sets the model provider for this agent. */
  provider(provider: Provider | string): this {
    this.#provider = provider;
    return this;
  }

  /** Replaces the full tool list for this agent. */
  tools(tools: readonly AgentTool[]): this {
    this.#tools = [...tools];
    return this;
  }

  /** Adds one tool to this agent. */
  tool(tool: AgentTool): this {
    this.#tools.push(tool);
    return this;
  }

  /** Replaces the full guardrail list for this agent. */
  guardrails(guardrails: readonly Guardrail[]): this {
    this.#guardrails = [...guardrails];
    return this;
  }

  /** Adds one guardrail to this agent. */
  guardrail(guardrail: Guardrail): this {
    this.#guardrails.push(guardrail);
    return this;
  }

  /** Replaces the full middleware list for this agent. */
  middleware(middleware: readonly Middleware[]): this {
    this.#middleware = [...middleware];
    return this;
  }

  /** Adds one middleware entry to this agent. */
  use(middleware: Middleware): this {
    this.#middleware.push(middleware);
    return this;
  }

  /** Sets the memory provider for this agent. */
  memory(memory: MemoryProvider): this {
    this.#memory = memory;
    return this;
  }

  /** Sets the session store for this agent. */
  sessionStore(sessionStore: SessionStore): this {
    this.#sessionStore = sessionStore;
    return this;
  }

  /** Sets the tracer for this agent. */
  tracer(tracer: Tracer): this {
    this.#tracer = tracer;
    return this;
  }

  /** Sets the event bus for this agent. */
  events(events: EventBus): this {
    this.#events = events;
    return this;
  }

  /** Sets the human approval integration for this agent. */
  humanApproval(humanApproval: HumanApproval): this {
    this.#humanApproval = humanApproval;
    return this;
  }

  /** Sets the handoff strategy for this agent. */
  handoff(handoff: HandoffStrategy): this {
    this.#handoff = handoff;
    return this;
  }

  /** Sets metadata for this agent. */
  metadata(metadata: Metadata): this {
    this.#metadata = metadata;
    return this;
  }

  /**
   * Builds an immutable Agent from the accumulated configuration.
   */
  build(): Agent {
    const config = this.#toConfig();
    validateAgentConfig(config);
    return new Agent(config);
  }

  #toConfig(): AgentConfig {
    const config: Partial<MutableAgentConfig> = {
      guardrails: this.#guardrails,
      middleware: this.#middleware,
      tools: this.#tools,
    };

    if (this.#name !== undefined) {
      config.name = this.#name;
    }

    if (this.#instructions !== undefined) {
      config.instructions = this.#instructions;
    }

    if (this.#provider !== undefined) {
      config.provider = this.#provider;
    }

    if (this.#memory !== undefined) {
      config.memory = this.#memory;
    }

    if (this.#sessionStore !== undefined) {
      config.sessionStore = this.#sessionStore;
    }

    if (this.#tracer !== undefined) {
      config.tracer = this.#tracer;
    }

    if (this.#events !== undefined) {
      config.events = this.#events;
    }

    if (this.#humanApproval !== undefined) {
      config.humanApproval = this.#humanApproval;
    }

    if (this.#handoff !== undefined) {
      config.handoff = this.#handoff;
    }

    if (this.#metadata !== undefined) {
      config.metadata = this.#metadata;
    }

    return config as AgentConfig;
  }
}
