import type { Metadata } from "../shared/index.js";

/**
 * Attributes attached to a trace span.
 */
export type TraceAttributes = Metadata;

/**
 * Active trace span.
 */
export interface TraceSpan {
  readonly id: string;
  setAttribute(key: string, value: TraceAttributes[string]): void;
  recordError(error: unknown): void;
  end(): void;
}

/**
 * Observability integration for Shiro execution.
 */
export interface Tracer {
  startSpan(name: string, attributes?: TraceAttributes): TraceSpan;
}
