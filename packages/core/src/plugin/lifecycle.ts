/**
 * Lifecycle state for a plugin installed into Shiro.
 */
export enum PluginLifecycle {
  Registered = "registered",
  Loaded = "loaded",
  Initialized = "initialized",
  Started = "started",
  Stopped = "stopped",
  Disposed = "disposed",
}
