import type { Agent, RunOptions, RunResult } from "../agent/index.js";
import { ConfigurationError, ShiroErrorCode } from "../errors/index.js";
import { AgentRegistry, HandoffDepthLimiter } from "../handoff/index.js";
import { PluginManager, type Plugin } from "../plugin/index.js";
import { ProviderRegistry, RegistryProviderResolver } from "../provider/index.js";
import type { RunContext } from "../runtime/index.js";
import { ToolRegistry } from "../tool/index.js";
import { EngineState } from "./lifecycle.js";
import { createId } from "./ids.js";
import { DefaultEngineContextFactory } from "./context-factory.js";
import { Runner } from "./runner.js";
import type {
  EngineConfig,
  EngineContextFactory,
  EngineServices,
  EngineSnapshot,
  RunInput,
  RunnerOptions,
} from "./types.js";

/**
 * Long-lived orchestration engine responsible for wiring execution dependencies.
 *
 * Engine creates Runner instances and owns shared services. It does not execute
 * providers, tools, memory, guardrails, tracing, approvals, or handoffs.
 */
export class Engine {
  readonly #id: string;
  readonly #services: EngineServices;
  readonly #providerRegistry: ProviderRegistry;
  readonly #toolRegistry: ToolRegistry;
  readonly #agentRegistry: AgentRegistry;
  readonly #handoffDepthLimiter: HandoffDepthLimiter;
  readonly #pluginManager: PluginManager;
  readonly #contextFactory: EngineContextFactory;
  #state = EngineState.Created;

  constructor(config: EngineConfig = {}) {
    this.#id = config.id ?? createId("engine");
    this.#providerRegistry = config.providerRegistry ?? new ProviderRegistry();
    this.#toolRegistry = config.toolRegistry ?? new ToolRegistry();
    this.#agentRegistry = config.agentRegistry ?? new AgentRegistry();
    this.#handoffDepthLimiter = config.handoffDepthLimiter ?? new HandoffDepthLimiter();
    this.#pluginManager =
      config.pluginManager ??
      new PluginManager(this.#providerRegistry, config.plugins, this.#toolRegistry);
    this.#services = freezeServices({
      ...config,
      agentRegistry: this.#agentRegistry,
      handoffDepthLimiter: this.#handoffDepthLimiter,
      toolRegistry: this.#toolRegistry,
    });
    this.#contextFactory = new DefaultEngineContextFactory(
      this.#services,
      config.providerResolver ?? new RegistryProviderResolver(this.#providerRegistry)
    );
  }

  /** Unique engine identifier. */
  get id(): string {
    return this.#id;
  }

  /** Current engine lifecycle state. */
  get state(): EngineState {
    return this.#state;
  }

  /** Provider registry owned by this engine. */
  get providerRegistry(): ProviderRegistry {
    return this.#providerRegistry;
  }

  /** Tool registry owned by this engine. */
  get toolRegistry(): ToolRegistry {
    return this.#toolRegistry;
  }

  /** Agent registry owned by this engine. */
  get agentRegistry(): AgentRegistry {
    return this.#agentRegistry;
  }

  /** Registers an agent for multi-agent orchestration. */
  registerAgent(agent: Agent): this {
    this.#agentRegistry.registerAgent(agent);
    return this;
  }

  /** Removes an agent from multi-agent orchestration. */
  unregisterAgent(name: string): boolean {
    return this.#agentRegistry.unregisterAgent(name);
  }

  /** Plugin manager owned by this engine. */
  get plugins(): PluginManager {
    return this.#pluginManager;
  }

  /** Installs a plugin into this engine. */
  use(plugin: Plugin): this {
    this.#pluginManager.install(plugin);
    return this;
  }

  /**
   * Starts the engine lifecycle.
   */
  start(): void {
    this.#transition(EngineState.Starting, [EngineState.Created, EngineState.Stopped]);
    this.#transition(EngineState.Ready, [EngineState.Starting]);
  }

  /**
   * Stops the engine lifecycle.
   */
  stop(): void {
    this.#transition(EngineState.Stopping, [EngineState.Ready, EngineState.Failed]);
    this.#transition(EngineState.Stopped, [EngineState.Stopping]);
  }

  /**
   * Marks the engine failed.
   */
  fail(): void {
    this.#transition(EngineState.Failed, [
      EngineState.Created,
      EngineState.Starting,
      EngineState.Ready,
      EngineState.Stopping,
    ]);
  }

  /**
   * Creates a runner for a single agent execution.
   */
  createRunner(agent: Agent, input: RunInput, options: RunOptions = {}): Runner {
    this.#ensureReady();

    const context = this.#createRunContext(agent, options);

    return new Runner({
      agent,
      context,
      input,
    });
  }

  /**
   * Executes one agent run through a new Runner instance.
   */
  async execute(agent: Agent, input: RunInput, options: RunOptions = {}): Promise<RunResult> {
    await this.#pluginManager.activate();
    const runner = this.createRunner(agent, input, options);
    return runner.execute();
  }

  /**
   * Returns a read-only snapshot of current engine state.
   */
  snapshot(): EngineSnapshot {
    return Object.freeze({
      id: this.id,
      state: this.state,
    });
  }

  #createRunContext(agent: Agent, options: RunnerOptions): RunContext {
    const context: Partial<MutableRunContext> = {
      agentName: agent.name,
      engine: this.#contextFactory.create(agent, options),
      runId: createId("run"),
    };

    if (options.sessionId !== undefined) {
      context.sessionId = options.sessionId;
    }

    if (options.signal !== undefined) {
      context.signal = options.signal;
    }

    if (options.maxIterations !== undefined) {
      context.maxIterations = options.maxIterations;
    }

    if (options.metadata !== undefined) {
      context.metadata = Object.freeze({ ...options.metadata });
    }

    return Object.freeze(context) as RunContext;
  }

  #ensureReady(): void {
    if (this.#state === EngineState.Created) {
      this.start();
    }

    if (this.#state !== EngineState.Ready) {
      throw new ConfigurationError({
        code: ShiroErrorCode.Configuration,
        message: `Cannot create a runner while engine is "${this.#state}".`,
      });
    }
  }

  #transition(next: EngineState, allowedFrom: readonly EngineState[]): void {
    if (!allowedFrom.includes(this.#state)) {
      throw new ConfigurationError({
        code: ShiroErrorCode.Configuration,
        message: `Invalid engine lifecycle transition from "${this.#state}" to "${next}".`,
      });
    }

    this.#state = next;
  }
}

type MutableRunContext = {
  -readonly [Key in keyof RunContext]: RunContext[Key];
};

function freezeServices(config: EngineConfig): EngineServices {
  const services: Partial<MutableEngineServices> = {};

  if (config.providerRegistry !== undefined) {
    services.providerRegistry = config.providerRegistry;
  }

  if (config.pluginManager !== undefined) {
    services.pluginManager = config.pluginManager;
  }

  if (config.plugins !== undefined) {
    services.plugins = config.plugins;
  }

  if (config.providerResolver !== undefined) {
    services.providerResolver = config.providerResolver;
  }

  if (config.approvalManager !== undefined) {
    services.approvalManager = config.approvalManager;
  }

  if (config.toolRegistry !== undefined) {
    services.toolRegistry = config.toolRegistry;
  }

  if (config.toolExecutor !== undefined) {
    services.toolExecutor = config.toolExecutor;
  }

  if (config.agentRegistry !== undefined) {
    services.agentRegistry = config.agentRegistry;
  }

  if (config.handoffDepthLimiter !== undefined) {
    services.handoffDepthLimiter = config.handoffDepthLimiter;
  }

  if (config.sessionManager !== undefined) {
    services.sessionManager = config.sessionManager;
  }

  if (config.sessionStore !== undefined) {
    services.sessionStore = config.sessionStore;
  }

  if (config.memoryManager !== undefined) {
    services.memoryManager = config.memoryManager;
  }

  if (config.memory !== undefined) {
    services.memory = config.memory;
  }

  if (config.contextCompactor !== undefined) {
    services.contextCompactor = config.contextCompactor;
  }

  if (config.tracer !== undefined) {
    services.tracer = config.tracer;
  }

  if (config.events !== undefined) {
    services.events = config.events;
  }

  if (config.metadata !== undefined) {
    services.metadata = Object.freeze({ ...config.metadata });
  }

  return Object.freeze(services);
}

type MutableEngineServices = {
  -readonly [Key in keyof EngineServices]: EngineServices[Key];
};
