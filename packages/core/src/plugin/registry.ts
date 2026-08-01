import { PluginError, ShiroErrorCode } from "../errors/index.js";
import { PluginLifecycle } from "./lifecycle.js";
import type { Plugin, PluginMetadata, PluginSnapshot } from "./types.js";

/**
 * Registry for installed plugins and their lifecycle state.
 */
export class PluginRegistry {
  readonly #entries = new Map<string, PluginRegistryEntry>();

  /** Registers a plugin and prevents duplicate plugin ids. */
  register(plugin: Plugin): void {
    const metadata = freezePluginMetadata(plugin.metadata);

    if (this.#entries.has(metadata.id)) {
      throwPluginError(`Plugin "${metadata.id}" is already registered.`);
    }

    this.#entries.set(
      metadata.id,
      Object.freeze({
        lifecycle: PluginLifecycle.Registered,
        metadata,
        plugin,
      })
    );
  }

  /** Removes a plugin entry by id. */
  unregister(id: string): boolean {
    return this.#entries.delete(id);
  }

  /** Returns true when a plugin id is registered. */
  has(id: string): boolean {
    return this.#entries.has(id);
  }

  /** Resolves a plugin by id. */
  resolve(id: string): Plugin {
    return this.#getEntry(id).plugin;
  }

  /** Reads a plugin lifecycle state. */
  lifecycle(id: string): PluginLifecycle {
    return this.#getEntry(id).lifecycle;
  }

  /** Updates a plugin lifecycle state. */
  setLifecycle(id: string, lifecycle: PluginLifecycle): void {
    const entry = this.#getEntry(id);
    this.#entries.set(id, Object.freeze({ ...entry, lifecycle }));
  }

  /** Lists registered plugins. */
  list(): readonly Plugin[] {
    return Object.freeze([...this.#entries.values()].map((entry) => entry.plugin));
  }

  /** Lists immutable plugin snapshots. */
  snapshots(): readonly PluginSnapshot[] {
    return Object.freeze(
      [...this.#entries.values()].map((entry) =>
        Object.freeze({
          lifecycle: entry.lifecycle,
          metadata: entry.metadata,
        })
      )
    );
  }

  #getEntry(id: string): PluginRegistryEntry {
    const entry = this.#entries.get(id);

    if (entry === undefined) {
      throwPluginError(`Plugin "${id}" is not registered.`);
    }

    return entry;
  }
}

interface PluginRegistryEntry {
  readonly plugin: Plugin;
  readonly metadata: PluginMetadata;
  readonly lifecycle: PluginLifecycle;
}

function freezePluginMetadata(metadata: PluginMetadata): PluginMetadata {
  const snapshot: Partial<MutablePluginMetadata> = {
    capabilities: Object.freeze(
      metadata.capabilities.map((capability) => Object.freeze({ ...capability }))
    ),
    id: metadata.id,
    name: metadata.name,
    version: metadata.version,
  };

  if (metadata.author !== undefined) {
    snapshot.author = metadata.author;
  }

  if (metadata.dependencies !== undefined) {
    snapshot.dependencies = Object.freeze(
      metadata.dependencies.map((dependency) => Object.freeze({ ...dependency }))
    );
  }

  if (metadata.description !== undefined) {
    snapshot.description = metadata.description;
  }

  if (metadata.homepage !== undefined) {
    snapshot.homepage = metadata.homepage;
  }

  if (metadata.keywords !== undefined) {
    snapshot.keywords = Object.freeze([...metadata.keywords]);
  }

  if (metadata.license !== undefined) {
    snapshot.license = metadata.license;
  }

  if (metadata.peerDependencies !== undefined) {
    snapshot.peerDependencies = Object.freeze(
      metadata.peerDependencies.map((dependency) => Object.freeze({ ...dependency }))
    );
  }

  return Object.freeze(snapshot) as PluginMetadata;
}

type MutablePluginMetadata = {
  -readonly [Key in keyof PluginMetadata]: PluginMetadata[Key];
};

function throwPluginError(message: string): never {
  throw new PluginError({
    code: ShiroErrorCode.Plugin,
    message,
  });
}
