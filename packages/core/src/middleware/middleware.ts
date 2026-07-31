import type { ShiroError } from "../errors/index.js";
import type { RunContext } from "../runtime/index.js";
import type { Metadata } from "../shared/index.js";

/**
 * Context shared by middleware lifecycle hooks.
 */
export interface MiddlewareContext extends RunContext {}

/**
 * Result-like shape exposed to middleware after a run completes.
 */
export interface MiddlewareRunResult {
  readonly runId: string;
  readonly output: unknown;
  readonly metadata?: Metadata;
}

/**
 * Cross-cutting lifecycle hooks for observing or decorating execution.
 */
export interface Middleware {
  readonly name?: string;
  beforeRun?(context: MiddlewareContext): Promise<void>;
  afterRun?(result: MiddlewareRunResult, context: MiddlewareContext): Promise<void>;
  onError?(error: ShiroError, context: MiddlewareContext): Promise<void>;
}
