import type { JsonObject, JsonValue, Metadata } from "../shared/index.js";

/**
 * Minimal schema contract for tool input validation.
 */
export interface ToolSchema<TInput> {
  readonly description?: string;
  parse(input: unknown): TInput;
  toJSONSchema?(): JsonObject;
}

/**
 * Request for a provider-visible tool call.
 */
export interface ToolCallRequest {
  readonly id?: string;
  readonly name: string;
  readonly arguments?: JsonObject;
  readonly metadata?: Metadata;
}

/**
 * Result produced by a tool execution.
 */
export interface ToolCallResult<TOutput = JsonValue> {
  readonly toolCallId?: string;
  readonly name: string;
  readonly output: TOutput;
  readonly metadata?: Metadata;
}

/**
 * Context passed to a tool when Shiro invokes it.
 */
export interface ToolContext {
  readonly runId: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}

/**
 * Developer-provided capability callable by an agent.
 */
export interface Tool<TInput = JsonObject, TOutput = JsonValue> {
  readonly name: string;
  readonly description?: string;
  readonly schema: ToolSchema<TInput>;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}

/**
 * Read-only registry used to resolve available tools.
 */
export interface ToolRegistry {
  list(): readonly Tool[];
  get(name: string): Tool | undefined;
}
