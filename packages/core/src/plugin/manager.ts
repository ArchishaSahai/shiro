import { PluginError, ShiroErrorCode } from "../errors/index.js";
import type { ProviderRegistry } from "../provider/index.js";
import { DefaultPluginContext } from "./context.js";
import { PluginLifecycle } from "./lifecycle.js";
import { PluginRegistry } from "./registry.js";
import type {
  Plugin,
  PluginContributions,
  PluginLoader,
  PluginManagerConfig,
  PluginSnapshot,
} from "./types.js";

/**
 * Coordinates plugin installation, discovery, dependency validation, and lifecycle.
 */
export class PluginManager {
  readonly #registry = new PluginRegistry();
  readonly #context: DefaultPluginContext;
  readonly #loaders: readonly PluginLoader[];

  constructor(providerRegistry: ProviderRegistry, config: PluginManagerConfig = {}) {
    this.#context = new DefaultPluginContext(providerRegistry);
    this.#loaders = Object.freeze([...(config.loaders ?? [])]);

    for (const plugin of config.plugins ?? []) {
      this.install(plugin);
    }
  }

  /** Installs a plugin in the registered lifecycle state. */
  install(plugin: Plugin): void {
    this.#registry.register(plugin);
    this.#validateDependencies();
  }

  /** Removes a plugin by id. */
  remove(id: string): boolean {
    const lifecycle = this.#registry.has(id) ? this.#registry.lifecycle(id) : undefined;

    if (
      lifecycle !== undefined &&
      lifecycle !== PluginLifecycle.Registered &&
      lifecycle !== PluginLifecycle.Disposed
    ) {
      throwPluginError(`Cannot remove plugin "${id}" while lifecycle is "${lifecycle}".`);
    }

    return this.#registry.unregister(id);
  }

  /** Discovers plugins from configured loaders and installs them. */
  async discover(): Promise<void> {
    for (const loader of this.#loaders) {
      const plugins = await loader.load();

      for (const plugin of plugins) {
        this.install(plugin);
      }
    }
  }

  /** Loads all registered plugins. */
  async load(): Promise<void> {
    this.#validateDependencies();
    await this.#runLifecycle(PluginLifecycle.Registered, PluginLifecycle.Loaded, "load");
  }

  /** Initializes all loaded plugins. */
  async initialize(): Promise<void> {
    await this.#runLifecycle(PluginLifecycle.Loaded, PluginLifecycle.Initialized, "initialize");
  }

  /** Starts all initialized plugins. */
  async start(): Promise<void> {
    await this.#runLifecycle(PluginLifecycle.Initialized, PluginLifecycle.Started, "start");
  }

  /** Stops all started plugins. */
  async stop(): Promise<void> {
    await this.#runLifecycle(PluginLifecycle.Started, PluginLifecycle.Stopped, "stop");
  }

  /** Disposes all stopped or registered plugins. */
  async dispose(): Promise<void> {
    for (const plugin of this.#registry.list()) {
      const lifecycle = this.#registry.lifecycle(plugin.metadata.id);

      if (
        lifecycle !== PluginLifecycle.Stopped &&
        lifecycle !== PluginLifecycle.Registered &&
        lifecycle !== PluginLifecycle.Loaded &&
        lifecycle !== PluginLifecycle.Initialized
      ) {
        throwPluginError(
          `Cannot dispose plugin "${plugin.metadata.id}" while lifecycle is "${lifecycle}".`
        );
      }

      await plugin.dispose?.(this.#context);
      this.#registry.setLifecycle(plugin.metadata.id, PluginLifecycle.Disposed);
    }
  }

  /** Returns true when a plugin is installed. */
  has(id: string): boolean {
    return this.#registry.has(id);
  }

  /** Lists installed plugins. */
  list(): readonly Plugin[] {
    return this.#registry.list();
  }

  /** Lists immutable plugin lifecycle snapshots. */
  snapshots(): readonly PluginSnapshot[] {
    return this.#registry.snapshots();
  }

  /** Returns contributions registered through PluginContext. */
  contributions(): PluginContributions {
    return this.#context.snapshot();
  }

  async #runLifecycle(
    from: PluginLifecycle,
    to: PluginLifecycle,
    hook: keyof Pick<Plugin, "load" | "initialize" | "start" | "stop">
  ): Promise<void> {
    for (const plugin of this.#registry.list()) {
      const lifecycle = this.#registry.lifecycle(plugin.metadata.id);

      if (lifecycle !== from) {
        throwPluginError(
          `Cannot ${hook} plugin "${plugin.metadata.id}" while lifecycle is "${lifecycle}".`
        );
      }

      await plugin[hook]?.(this.#context);
      this.#registry.setLifecycle(plugin.metadata.id, to);
    }
  }

  #validateDependencies(): void {
    for (const plugin of this.#registry.list()) {
      for (const dependency of plugin.metadata.dependencies ?? []) {
        if (dependency.optional === true) {
          continue;
        }

        if (!this.#registry.has(dependency.id)) {
          throwPluginError(
            `Plugin "${plugin.metadata.id}" depends on missing plugin "${dependency.id}".`
          );
        }
      }
    }
  }
}

function throwPluginError(message: string): never {
  throw new PluginError({
    code: ShiroErrorCode.Plugin,
    message,
  });
}
