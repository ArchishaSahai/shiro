import {
  ToolExecutionError,
  ToolNotFoundError,
  ShiroErrorCode,
  TimeoutError,
} from "../errors/index.js";
import type { ApprovalPolicy } from "../approval/index.js";
import type { EngineContext } from "../runtime/index.js";
import type { JsonObject, JsonValue, Metadata } from "../shared/index.js";

/**
 * Minimal schema contract for tool input validation.
 */
export interface ToolSchema<TInput = JsonObject> {
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
 * Model-requested tool call normalized by Shiro.
 */
export interface ToolCall extends ToolCallRequest {}

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
 * Result produced by a tool execution.
 */
export interface ToolResult<TOutput = JsonValue> extends ToolCallResult<TOutput> {
  readonly state: ToolExecutionState;
  readonly durationMs: number;
  readonly error?: ToolExecutionError;
}

/**
 * Context passed to a tool when Shiro invokes it.
 */
export interface ToolContext {
  readonly runId: string;
  readonly agentName: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
  readonly engine: EngineContext;
  readonly logger?: ToolLogger;
}

/**
 * Developer-provided capability callable by an agent.
 */
export interface Tool<TInput = JsonObject, TOutput = JsonValue> {
  readonly name: string;
  readonly description?: string;
  readonly requiresApproval?: boolean;
  readonly approvalPolicy?: ApprovalPolicy;
  readonly approvalDescription?: string;
  readonly schema: ToolSchema<TInput>;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}

/**
 * Logger surface provided to tool executions.
 */
export interface ToolLogger {
  debug(message: string, metadata?: Metadata): void;
  info(message: string, metadata?: Metadata): void;
  warn(message: string, metadata?: Metadata): void;
  error(message: string, metadata?: Metadata): void;
}

/**
 * Options used when defining a tool.
 */
export interface ToolDefinition<TInput = JsonObject, TOutput = JsonValue> {
  readonly name: string;
  readonly description?: string;
  readonly requiresApproval?: boolean;
  readonly approvalPolicy?: ApprovalPolicy;
  readonly approvalDescription?: string;
  readonly parameters: ToolSchema<TInput>;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}

/**
 * Options controlling one tool execution.
 */
export interface ToolExecutionOptions {
  readonly timeoutMs?: number;
}

/**
 * State reached by one tool execution.
 */
export enum ToolExecutionState {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  TimedOut = "timed_out",
  Cancelled = "cancelled",
}

/**
 * Immutable registry used to resolve available tools.
 */
export class ToolRegistry {
  readonly #tools = new Map<string, Tool>();

  constructor(tools: readonly Tool[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Registers a tool by name. */
  register(tool: Tool): void {
    validateTool(tool);

    if (this.#tools.has(tool.name)) {
      throw new ToolExecutionError({
        code: ShiroErrorCode.ToolExecution,
        message: `Tool "${tool.name}" is already registered.`,
      });
    }

    this.#tools.set(tool.name, freezeTool(tool));
  }

  /** Removes a tool by name. */
  unregister(name: string): boolean {
    return this.#tools.delete(name);
  }

  /** Resolves a tool by name or throws when unavailable. */
  resolve(name: string): Tool {
    const tool = this.#tools.get(name);

    if (tool === undefined) {
      throw new ToolNotFoundError({
        code: ShiroErrorCode.ToolNotFound,
        message: `Tool "${name}" is not registered.`,
      });
    }

    return tool;
  }

  /** Returns a tool by name when registered. */
  get(name: string): Tool | undefined {
    return this.#tools.get(name);
  }

  /** Returns true when a tool name is registered. */
  has(name: string): boolean {
    return this.#tools.has(name);
  }

  /** Lists registered tools. */
  list(): readonly Tool[] {
    return Object.freeze([...this.#tools.values()]);
  }
}

/**
 * Executes tools with validation, cancellation, timeouts, and serialization.
 */
export class ToolExecutor {
  readonly #registry: ToolRegistry;
  readonly #serializer: ToolSerializer;

  constructor(registry: ToolRegistry, serializer = new ToolSerializer()) {
    this.#registry = registry;
    this.#serializer = serializer;
  }

  /** Executes one normalized tool call. */
  async execute(
    call: ToolCall,
    context: ToolContext,
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const startedAt = Date.now();
    const tool = this.#registry.resolve(call.name);

    try {
      throwIfAborted(context.signal);
      const input = validateToolArguments(tool, call.arguments ?? {});
      const output = await withTimeout(
        tool.execute(input, context),
        options.timeoutMs,
        context.signal
      );
      const result = this.#serializer.serialize(
        call,
        output,
        ToolExecutionState.Completed,
        Date.now() - startedAt
      );
      return result;
    } catch (error) {
      const mapped = toToolExecutionError(error, call);
      const state =
        error instanceof TimeoutError
          ? ToolExecutionState.TimedOut
          : context.signal?.aborted === true
            ? ToolExecutionState.Cancelled
            : ToolExecutionState.Failed;

      return this.#serializer.serializeError(call, mapped, state, Date.now() - startedAt);
    }
  }
}

/**
 * Converts tool outputs and failures into provider-visible JSON-safe results.
 */
export class ToolSerializer {
  /** Serializes a successful tool output. */
  serialize(
    call: ToolCall,
    output: unknown,
    state: ToolExecutionState,
    durationMs: number
  ): ToolResult {
    const result: Partial<MutableToolResult<JsonValue>> = {
      durationMs,
      name: call.name,
      output: toJsonValue(output),
      state,
    };

    if (call.id !== undefined) {
      result.toolCallId = call.id;
    }

    return freezeToolResult(result as ToolResult);
  }

  /** Serializes a failed tool output. */
  serializeError(
    call: ToolCall,
    error: ToolExecutionError,
    state: ToolExecutionState,
    durationMs: number
  ): ToolResult {
    const result: Partial<MutableToolResult<Readonly<{ error: string }>>> = {
      durationMs,
      error,
      name: call.name,
      output: Object.freeze({
        error: error.message,
      }),
      state,
    };

    if (call.id !== undefined) {
      result.toolCallId = call.id;
    }

    return freezeToolResult(result as ToolResult);
  }
}

/**
 * Defines an immutable tool from a developer-authored descriptor.
 */
export function tool<TInput = JsonObject, TOutput = JsonValue>(
  definition: ToolDefinition<TInput, TOutput>
): Tool<TInput, TOutput> {
  const created: Partial<MutableTool<TInput, TOutput>> = {
    execute: (input, context) => definition.execute(input, context),
    name: definition.name,
    schema: definition.parameters,
  };

  if (definition.description !== undefined) {
    created.description = definition.description;
  }

  if (definition.requiresApproval !== undefined) {
    created.requiresApproval = definition.requiresApproval;
  }

  if (definition.approvalPolicy !== undefined) {
    created.approvalPolicy = definition.approvalPolicy;
  }

  if (definition.approvalDescription !== undefined) {
    created.approvalDescription = definition.approvalDescription;
  }

  return Object.freeze(created) as Tool<TInput, TOutput>;
}

type MutableTool<TInput, TOutput> = {
  -readonly [Key in keyof Tool<TInput, TOutput>]: Tool<TInput, TOutput>[Key];
};

/**
 * Validates a tool definition.
 */
export function validateTool(tool: Tool): void {
  assertNonEmptyString(tool.name, "Tool name is required.");

  if (tool.description !== undefined) {
    assertNonEmptyString(tool.description, `Tool "${tool.name}" description cannot be empty.`);
  }

  if (typeof tool.schema.parse !== "function") {
    throwToolError(`Tool "${tool.name}" must provide a schema parser.`);
  }

  if (typeof tool.execute !== "function") {
    throwToolError(`Tool "${tool.name}" must provide an execute function.`);
  }
}

/**
 * Validates model-supplied arguments for a tool.
 */
export function validateToolArguments<TInput>(tool: Tool<TInput>, input: unknown): TInput {
  try {
    return tool.schema.parse(input);
  } catch (error) {
    throw new ToolExecutionError({
      cause: error,
      code: ShiroErrorCode.ToolExecution,
      message: `Tool "${tool.name}" argument validation failed.`,
    });
  }
}

function freezeTool<TInput, TOutput>(tool: Tool<TInput, TOutput>): Tool<TInput, TOutput> {
  return Object.freeze({ ...tool });
}

function freezeToolResult<TOutput>(result: ToolResult<TOutput>): ToolResult<TOutput> {
  const snapshot: Partial<MutableToolResult<TOutput>> = {
    durationMs: result.durationMs,
    name: result.name,
    output: result.output,
    state: result.state,
  };

  if (result.toolCallId !== undefined) {
    snapshot.toolCallId = result.toolCallId;
  }

  if (result.metadata !== undefined) {
    snapshot.metadata = Object.freeze({ ...result.metadata });
  }

  if (result.error !== undefined) {
    snapshot.error = result.error;
  }

  return Object.freeze(snapshot) as ToolResult<TOutput>;
}

type MutableToolResult<TOutput> = {
  -readonly [Key in keyof ToolResult<TOutput>]: ToolResult<TOutput>[Key];
};

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => toJsonValue(entry)));
  }

  if (typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]))
    );
  }

  return null;
}

async function withTimeout<TValue>(
  operation: Promise<TValue>,
  timeoutMs: number | undefined,
  signal: AbortSignal | undefined
): Promise<TValue> {
  if (timeoutMs === undefined) {
    return operation;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<TValue>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new TimeoutError({
              code: ShiroErrorCode.Timeout,
              message: `Tool execution exceeded ${String(timeoutMs)}ms.`,
            })
          );
        }, timeoutMs);

        signal?.addEventListener(
          "abort",
          () => {
            reject(
              new ToolExecutionError({
                code: ShiroErrorCode.ToolExecution,
                message: "Tool execution was cancelled.",
              })
            );
          },
          { once: true }
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new ToolExecutionError({
      code: ShiroErrorCode.ToolExecution,
      message: "Tool execution was cancelled.",
    });
  }
}

function toToolExecutionError(error: unknown, call: ToolCall): ToolExecutionError {
  if (error instanceof TimeoutError) {
    return new ToolExecutionError({
      cause: error,
      code: ShiroErrorCode.ToolExecution,
      message: `Tool "${call.name}" timed out.`,
    });
  }

  if (error instanceof ToolExecutionError) {
    return error;
  }

  return new ToolExecutionError({
    cause: error,
    code: ShiroErrorCode.ToolExecution,
    message: `Tool "${call.name}" execution failed.`,
  });
}

function assertNonEmptyString(value: unknown, message: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throwToolError(message);
  }
}

function throwToolError(message: string): never {
  throw new ToolExecutionError({
    code: ShiroErrorCode.ToolExecution,
    message,
  });
}
