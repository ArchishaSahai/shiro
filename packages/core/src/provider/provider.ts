import { ProviderError, ShiroErrorCode } from "../errors/index.js";
import type { JsonObject, Message, Metadata } from "../shared/index.js";
import type { ToolCallRequest } from "../tool/index.js";

/**
 * Provider feature flags used by orchestration code.
 */
export interface ProviderCapabilities {
  readonly streaming: boolean;
  readonly vision: boolean;
  readonly embeddings: boolean;
  readonly toolCalling: boolean;
  readonly structuredOutputs: boolean;
  readonly reasoning: boolean;
}

/**
 * Immutable provider metadata exposed to Shiro and userland tooling.
 */
export interface ProviderMetadata {
  readonly id: string;
  readonly displayName: string;
  readonly supportedModels: readonly string[];
  readonly capabilities: ProviderCapabilities;
}

/**
 * Normalized request sent from Shiro to a model provider.
 */
export interface ProviderRequest {
  readonly messages: readonly Message[];
  readonly instructions?: string;
  readonly tools?: readonly ToolCallRequest[];
  readonly metadata?: Metadata;
}

/**
 * Context passed to providers for observability and cancellation.
 */
export interface ProviderContext {
  readonly runId: string;
  readonly agentName: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}

/**
 * Normalized model response returned to Shiro.
 */
export interface ProviderResponse {
  readonly message: Message;
  readonly toolCalls?: readonly ToolCallRequest[];
  readonly metadata?: Metadata;
}

/**
 * Framework-agnostic abstraction over an LLM provider.
 */
export interface Provider {
  readonly name: string;
  readonly metadata?: ProviderMetadata;
  generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResponse>;
}

/**
 * Base class for provider adapters.
 *
 * Concrete providers supply metadata and implement generate. This class does not
 * perform network calls or provider-specific behavior.
 */
export abstract class BaseProvider implements Provider {
  readonly #metadata: ProviderMetadata;

  protected constructor(metadata: ProviderMetadata) {
    this.#metadata = freezeProviderMetadata(metadata);
  }

  /** Stable provider name. */
  get name(): string {
    return this.#metadata.id;
  }

  /** Immutable provider metadata. */
  get metadata(): ProviderMetadata {
    return this.#metadata;
  }

  abstract generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResponse>;
}

/**
 * Provider construction input.
 */
export interface ProviderFactoryConfig {
  readonly provider: string;
  readonly model?: string;
  readonly options?: JsonObject;
  readonly metadata?: Metadata;
}

/**
 * Factory capable of creating a provider from configuration.
 */
export interface ProviderFactory<TConfig extends ProviderFactoryConfig = ProviderFactoryConfig> {
  readonly provider: string;
  create(config: TConfig): Provider;
}

/**
 * Registry for provider instances and provider factories.
 */
export class ProviderRegistry {
  readonly #providers = new Map<string, Provider>();
  readonly #factories = new Map<string, ProviderFactory>();

  constructor(providers: readonly Provider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /**
   * Registers a provider instance.
   */
  register(provider: Provider): void {
    assertProvider(provider);

    if (this.#providers.has(provider.name)) {
      throwProviderError(`Provider "${provider.name}" is already registered.`);
    }

    this.#providers.set(provider.name, provider);
  }

  /**
   * Removes a provider by name.
   */
  unregister(name: string): boolean {
    return this.#providers.delete(name);
  }

  /**
   * Resolves a provider by name.
   */
  resolve(name: string): Provider {
    const provider = this.#providers.get(name);

    if (provider === undefined) {
      throwProviderError(`Provider "${name}" is not registered.`);
    }

    return provider;
  }

  /**
   * Returns true when a provider name is registered.
   */
  has(name: string): boolean {
    return this.#providers.has(name);
  }

  /**
   * Lists registered providers.
   */
  list(): readonly Provider[] {
    return Object.freeze([...this.#providers.values()]);
  }

  /**
   * Registers a provider factory.
   */
  registerFactory(factory: ProviderFactory): void {
    if (this.#factories.has(factory.provider)) {
      throwProviderError(`Provider factory "${factory.provider}" is already registered.`);
    }

    this.#factories.set(factory.provider, factory);
  }

  /**
   * Creates a provider instance from a registered factory.
   */
  create(config: ProviderFactoryConfig): Provider {
    const factory = this.#factories.get(config.provider);

    if (factory === undefined) {
      throwProviderError(`Provider factory "${config.provider}" is not registered.`);
    }

    return factory.create(config);
  }

  /**
   * Lists registered provider factories.
   */
  listFactories(): readonly ProviderFactory[] {
    return Object.freeze([...this.#factories.values()]);
  }
}

/**
 * Resolves a provider for an agent execution.
 */
export interface ProviderResolver {
  resolve(provider: Provider | string): Provider;
}

/**
 * Default provider resolver backed by ProviderRegistry.
 */
export class RegistryProviderResolver implements ProviderResolver {
  readonly #registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.#registry = registry;
  }

  /**
   * Resolves provider instances directly or provider names through the registry.
   */
  resolve(provider: Provider | string): Provider {
    if (typeof provider === "string") {
      return this.#registry.resolve(provider);
    }

    return provider;
  }
}

/**
 * Normalizes unknown provider failures into ProviderError.
 */
export function toProviderError(
  error: unknown,
  message = "Provider operation failed."
): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError({
    cause: error,
    code: ShiroErrorCode.Provider,
    message,
  });
}

function assertProvider(provider: Provider): void {
  if (provider.name.trim().length === 0) {
    throwProviderError("Provider name is required.");
  }
}

function throwProviderError(message: string): never {
  throw new ProviderError({
    code: ShiroErrorCode.Provider,
    message,
  });
}

function freezeProviderMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return Object.freeze({
    capabilities: Object.freeze({ ...metadata.capabilities }),
    displayName: metadata.displayName,
    id: metadata.id,
    supportedModels: Object.freeze([...metadata.supportedModels]),
  });
}
