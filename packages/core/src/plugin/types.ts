import type { HumanApproval } from "../approval/index.js";
import type { EventHandler, ShiroEvent, ShiroEventType } from "../events/index.js";
import type { Guardrail } from "../guardrails/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Middleware } from "../middleware/index.js";
import type { Provider } from "../provider/index.js";
import type { JsonObject, Metadata } from "../shared/index.js";
import type { Tool } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";
import type { PluginLifecycle } from "./lifecycle.js";

/**
 * Feature categories a plugin can contribute.
 */
export enum PluginCapability {
  Provider = "provider",
  Tool = "tool",
  Memory = "memory",
  Middleware = "middleware",
  Guardrail = "guardrail",
  Approval = "approval",
  Tracing = "tracing",
  Studio = "studio",
}

/**
 * Plugin capability declaration.
 */
export interface PluginCapabilityDefinition {
  readonly type: PluginCapability;
  readonly name?: string;
  readonly metadata?: Metadata;
}

/**
 * Dependency relationship declared by a plugin.
 */
export interface PluginDependency {
  readonly id: string;
  readonly version?: string;
  readonly optional?: boolean;
}

/**
 * Immutable public metadata for a plugin.
 */
export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author?: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly license?: string;
  readonly keywords?: readonly string[];
  readonly dependencies?: readonly PluginDependency[];
  readonly peerDependencies?: readonly PluginDependency[];
  readonly capabilities: readonly PluginCapabilityDefinition[];
}

/**
 * Future Studio extension descriptor registered by a plugin.
 */
export interface StudioExtension {
  readonly id: string;
  readonly name: string;
  readonly metadata?: Metadata;
}

/**
 * Event listener contribution from a plugin.
 */
export interface PluginEventListener {
  readonly type: ShiroEventType;
  readonly handler: (event: ShiroEvent) => void | Promise<void>;
}

/**
 * Contributions registered through PluginContext.
 */
export interface PluginContributions {
  readonly providers: readonly Provider[];
  readonly tools: readonly Tool[];
  readonly middleware: readonly Middleware[];
  readonly guardrails: readonly Guardrail[];
  readonly memoryProviders: readonly MemoryProvider[];
  readonly tracers: readonly Tracer[];
  readonly approvals: readonly HumanApproval[];
  readonly eventListeners: readonly PluginEventListener[];
  readonly studioExtensions: readonly StudioExtension[];
}

/**
 * Stable extension surface exposed to plugins.
 */
export interface PluginContext {
  registerProvider(provider: Provider): void;
  registerTool(tool: Tool): void;
  registerMiddleware(middleware: Middleware): void;
  registerMemory(memory: MemoryProvider): void;
  registerGuardrail(guardrail: Guardrail): void;
  registerTracer(tracer: Tracer): void;
  registerApproval(approval: HumanApproval): void;
  registerEventListener<TType extends ShiroEventType>(
    type: TType,
    handler: EventHandler<TType>
  ): void;
  registerStudioExtension(extension: StudioExtension): void;
}

/**
 * Shiro plugin contract.
 */
export interface Plugin {
  readonly metadata: PluginMetadata;
  load?(context: PluginContext): void | Promise<void>;
  initialize?(context: PluginContext): void | Promise<void>;
  start?(context: PluginContext): void | Promise<void>;
  stop?(context: PluginContext): void | Promise<void>;
  dispose?(context: PluginContext): void | Promise<void>;
}

/**
 * Loader abstraction for discovering plugins.
 */
export interface PluginLoader {
  load(): Promise<readonly Plugin[]> | readonly Plugin[];
}

/**
 * Plugin lifecycle state snapshot.
 */
export interface PluginSnapshot {
  readonly metadata: PluginMetadata;
  readonly lifecycle: PluginLifecycle;
}

/**
 * Optional plugin manager configuration.
 */
export interface PluginManagerConfig {
  readonly plugins?: readonly Plugin[];
  readonly loaders?: readonly PluginLoader[];
  readonly metadata?: JsonObject;
}
