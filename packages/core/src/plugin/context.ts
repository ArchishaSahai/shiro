import type { HumanApproval } from "../approval/index.js";
import type { EventHandler, ShiroEventType } from "../events/index.js";
import type { Guardrail } from "../guardrails/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Middleware } from "../middleware/index.js";
import type { Provider, ProviderRegistry } from "../provider/index.js";
import type { Tool } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";
import type {
  PluginContext,
  PluginContributions,
  PluginEventListener,
  StudioExtension,
} from "./types.js";

/**
 * Default PluginContext implementation backed by explicit extension sinks.
 */
export class DefaultPluginContext implements PluginContext {
  readonly #providerRegistry: ProviderRegistry;
  readonly #tools: Tool[] = [];
  readonly #middleware: Middleware[] = [];
  readonly #guardrails: Guardrail[] = [];
  readonly #memoryProviders: MemoryProvider[] = [];
  readonly #tracers: Tracer[] = [];
  readonly #approvals: HumanApproval[] = [];
  readonly #eventListeners: PluginEventListener[] = [];
  readonly #studioExtensions: StudioExtension[] = [];

  constructor(providerRegistry: ProviderRegistry) {
    this.#providerRegistry = providerRegistry;
  }

  /** Registers a provider with the provider registry. */
  registerProvider(provider: Provider): void {
    this.#providerRegistry.register(provider);
  }

  /** Registers a tool contribution. */
  registerTool(tool: Tool): void {
    this.#tools.push(tool);
  }

  /** Registers a middleware contribution. */
  registerMiddleware(middleware: Middleware): void {
    this.#middleware.push(middleware);
  }

  /** Registers a memory provider contribution. */
  registerMemory(memory: MemoryProvider): void {
    this.#memoryProviders.push(memory);
  }

  /** Registers a guardrail contribution. */
  registerGuardrail(guardrail: Guardrail): void {
    this.#guardrails.push(guardrail);
  }

  /** Registers a tracer contribution. */
  registerTracer(tracer: Tracer): void {
    this.#tracers.push(tracer);
  }

  /** Registers a human approval contribution. */
  registerApproval(approval: HumanApproval): void {
    this.#approvals.push(approval);
  }

  /** Registers an event listener contribution. */
  registerEventListener<TType extends ShiroEventType>(
    type: TType,
    handler: EventHandler<TType>
  ): void {
    this.#eventListeners.push(createEventListener(type, handler));
  }

  /** Registers a future Studio extension contribution. */
  registerStudioExtension(extension: StudioExtension): void {
    this.#studioExtensions.push(Object.freeze({ ...extension }));
  }

  /** Returns immutable contributions registered through this context. */
  snapshot(): PluginContributions {
    return Object.freeze({
      approvals: Object.freeze([...this.#approvals]),
      eventListeners: Object.freeze([...this.#eventListeners]),
      guardrails: Object.freeze([...this.#guardrails]),
      memoryProviders: Object.freeze([...this.#memoryProviders]),
      middleware: Object.freeze([...this.#middleware]),
      providers: this.#providerRegistry.list(),
      studioExtensions: Object.freeze([...this.#studioExtensions]),
      tools: Object.freeze([...this.#tools]),
      tracers: Object.freeze([...this.#tracers]),
    });
  }
}

function createEventListener<TType extends ShiroEventType>(
  type: TType,
  handler: EventHandler<TType>
): PluginEventListener {
  return Object.freeze({
    handler: handler as PluginEventListener["handler"],
    type,
  });
}
