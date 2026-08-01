import type { Guardrail } from "../guardrails/index.js";
import type { HandoffStrategy } from "../handoff/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Middleware } from "../middleware/index.js";
import type { OutputSchema } from "../output/index.js";
import type { Provider } from "../provider/index.js";
import type { RunContext } from "../runtime/index.js";
import type { SessionStore } from "../session/index.js";
import type {
  CancellationOptions,
  FinishReason,
  Message,
  Metadata,
  TimeoutOptions,
} from "../shared/index.js";
import type { Tool } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";
import type { HumanApproval } from "../approval/index.js";
import type { EventBus } from "../events/index.js";
import { AgentBuilder } from "./builder.js";
import { cloneAgentConfig, validateAgentConfig } from "./validation.js";

/**
 * Immutable public definition for an agent.
 */
export interface AgentConfig<TOutput = string> {
  readonly name: string;
  readonly instructions: string;
  readonly provider: Provider | string;
  readonly output?: OutputSchema<TOutput>;
  readonly tools?: readonly AgentTool[];
  readonly guardrails?: readonly Guardrail[];
  readonly middleware?: readonly Middleware[];
  readonly memory?: MemoryProvider;
  readonly sessionStore?: SessionStore;
  readonly tracer?: Tracer;
  readonly events?: EventBus;
  readonly humanApproval?: HumanApproval;
  readonly handoff?: HandoffStrategy;
  readonly metadata?: Metadata;
}

/**
 * Options used when constructing or deriving an agent.
 */
export interface AgentOptions {
  readonly metadata?: Metadata;
}

/**
 * Options for a single agent run.
 */
export interface RunOptions extends CancellationOptions, TimeoutOptions {
  readonly sessionId?: string;
  readonly maxIterations?: number;
  readonly metadata?: Metadata;
}

/**
 * Successful terminal result of an agent run.
 */
export interface RunResult<TOutput = string> {
  readonly runId: string;
  readonly output: TOutput;
  readonly messages: readonly Message[];
  readonly finishReason: FinishReason;
  readonly context: RunContext;
  readonly metadata?: Metadata;
}

/**
 * Developer-facing immutable agent definition.
 *
 * Agent owns configuration only. It does not execute runs, call providers,
 * invoke tools, or coordinate runtime behavior.
 */
export class Agent<TOutput = string> {
  readonly #config: AgentConfig<TOutput>;

  constructor(config: AgentConfig<TOutput>) {
    validateAgentConfig(config);
    this.#config = cloneAgentConfig(config);
  }

  /**
   * Creates a fluent builder that produces the same immutable Agent type.
   */
  static builder(): AgentBuilder {
    return new AgentBuilder();
  }

  /** Agent name used for tracing, events, and diagnostics. */
  get name(): string {
    return this.#config.name;
  }

  /** Developer-authored instructions associated with this agent. */
  get instructions(): string {
    return this.#config.instructions;
  }

  /** Provider selected for this agent. */
  get provider(): Provider | string {
    return this.#config.provider;
  }

  /** Optional final-output schema for structured responses. */
  get output(): OutputSchema<TOutput> | undefined {
    return this.#config.output;
  }

  /** Tools available to this agent. */
  get tools(): readonly AgentTool[] {
    return this.#config.tools ?? [];
  }

  /** Guardrails configured for this agent. */
  get guardrails(): readonly Guardrail[] {
    return this.#config.guardrails ?? [];
  }

  /** Middleware configured for this agent. */
  get middleware(): readonly Middleware[] {
    return this.#config.middleware ?? [];
  }

  /** Optional memory provider configured for this agent. */
  get memory(): MemoryProvider | undefined {
    return this.#config.memory;
  }

  /** Optional session store configured for this agent. */
  get sessionStore(): SessionStore | undefined {
    return this.#config.sessionStore;
  }

  /** Optional tracer configured for this agent. */
  get tracer(): Tracer | undefined {
    return this.#config.tracer;
  }

  /** Optional event bus configured for this agent. */
  get events(): EventBus | undefined {
    return this.#config.events;
  }

  /** Optional human approval integration configured for this agent. */
  get humanApproval(): HumanApproval | undefined {
    return this.#config.humanApproval;
  }

  /** Optional handoff strategy configured for this agent. */
  get handoff(): HandoffStrategy | undefined {
    return this.#config.handoff;
  }

  /** Immutable agent metadata. */
  get metadata(): Metadata | undefined {
    return this.#config.metadata;
  }

  /**
   * Returns the immutable configuration snapshot stored by this agent.
   */
  get config(): AgentConfig<TOutput> {
    return this.#config;
  }
}

/**
 * Capabilities available to an agent as callable tools.
 */
export type AgentTool = Tool | Agent<unknown>;
