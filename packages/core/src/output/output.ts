import { ValidationError, type ShiroErrorDetails, ShiroErrorCode } from "../errors/index.js";
import type { Provider, ProviderContext, ProviderResponse } from "../provider/index.js";
import { MessageRole, type Message, type Metadata } from "../shared/index.js";

/**
 * Schema contract accepted by Shiro for validating final agent output.
 *
 * Zod schemas satisfy this interface directly, and future schema libraries can
 * adapt to it without changing Runner.
 */
export interface OutputSchema<TOutput = unknown> {
  parse(input: unknown): TOutput;
  safeParse?(input: unknown): SafeParseResult<TOutput>;
}

/**
 * Infers the TypeScript output from a supported output schema.
 */
export type InferOutput<TSchema> = TSchema extends OutputSchema<infer TOutput> ? TOutput : string;

/**
 * Result shape used by schema libraries that support non-throwing validation.
 */
export type SafeParseResult<TOutput> =
  | {
      readonly success: true;
      readonly data: TOutput;
    }
  | {
      readonly success: false;
      readonly error: unknown;
    };

/**
 * One normalized validation issue returned to userland diagnostics and repair prompts.
 */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/**
 * Typed validation outcome for structured outputs.
 */
export type ValidationResult<TOutput> =
  | {
      readonly success: true;
      readonly value: TOutput;
    }
  | {
      readonly success: false;
      readonly issues: readonly ValidationIssue[];
      readonly error: ValidationError;
    };

/**
 * Parses raw model text before schema validation.
 */
export interface OutputParser {
  parse(raw: string): unknown;
}

/**
 * Validates parsed output against a schema.
 */
export interface OutputValidator {
  validate<TOutput>(
    schema: OutputSchema<TOutput>,
    value: unknown,
    context?: OutputValidationContext
  ): ValidationResult<TOutput>;
}

/**
 * Retry policy used for structured-output repair.
 */
export interface RetryPolicy {
  readonly maxRetries: number;
}

/**
 * Input used to build a repair request.
 */
export interface OutputRepairRequest {
  readonly rawOutput: string;
  readonly issues: readonly ValidationIssue[];
  readonly messages: readonly Message[];
  readonly attempt: number;
}

/**
 * Strategy for asking the model to repair invalid structured output.
 */
export interface OutputRepairStrategy {
  createMessages(request: OutputRepairRequest): readonly Message[];
}

/**
 * Context attached to validation errors.
 */
export interface OutputValidationContext {
  readonly runId: string;
  readonly agentName: string;
  readonly metadata?: Metadata;
}

/**
 * Request handled by StructuredOutputManager.
 */
export interface StructuredOutputRequest<TOutput> {
  readonly schema: OutputSchema<TOutput>;
  readonly rawOutput: string;
  readonly messages: readonly Message[];
  readonly provider: Provider;
  readonly providerContext: ProviderContext;
  readonly instructions?: string;
  readonly retryPolicy?: RetryPolicy;
  readonly events?: StructuredOutputEvents;
}

/**
 * Successfully validated structured-output result.
 */
export interface StructuredOutputResult<TOutput> {
  readonly output: TOutput;
  readonly messages: readonly Message[];
  readonly response: ProviderResponse;
  readonly repairAttempts: number;
}

/**
 * Optional callbacks used by Runner to translate output lifecycle into Shiro events.
 */
export interface StructuredOutputEvents {
  validationStarted(attempt: number): void | Promise<void>;
  validationSucceeded(attempt: number): void | Promise<void>;
  validationFailed(attempt: number, issues: readonly ValidationIssue[]): void | Promise<void>;
  repairStarted(attempt: number, issues: readonly ValidationIssue[]): void | Promise<void>;
  repairCompleted(attempt: number): void | Promise<void>;
  repairFailed(attempt: number, error: ValidationError): void | Promise<void>;
}

/**
 * Default parser for provider text.
 *
 * JSON is parsed into structured values; non-JSON text remains a string so
 * string output schemas continue to work naturally.
 */
export class JsonOutputParser implements OutputParser {
  parse(raw: string): unknown {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      return "";
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return raw;
    }
  }
}

/**
 * Default schema validator for OutputSchema-compatible libraries.
 */
export class SchemaOutputValidator implements OutputValidator {
  validate<TOutput>(
    schema: OutputSchema<TOutput>,
    value: unknown,
    context?: OutputValidationContext
  ): ValidationResult<TOutput> {
    const safeResult = schema.safeParse?.(value);

    if (safeResult !== undefined) {
      return safeResult.success
        ? Object.freeze({ success: true, value: safeResult.data })
        : this.#failure(safeResult.error, context);
    }

    try {
      return Object.freeze({ success: true, value: schema.parse(value) });
    } catch (error) {
      return this.#failure(error, context);
    }
  }

  #failure(error: unknown, context?: OutputValidationContext): ValidationResult<never> {
    const issues = normalizeValidationIssues(error);
    const details: Partial<MutableValidationErrorDetails> = {
      cause: error,
      code: ShiroErrorCode.Validation,
      message: formatValidationMessage(issues),
    };

    if (context?.runId !== undefined) {
      details.runId = context.runId;
    }

    if (context?.metadata !== undefined) {
      details.metadata = context.metadata;
    }

    return Object.freeze({
      error: new ValidationError(details as MutableValidationErrorDetails),
      issues,
      success: false,
    });
  }
}

/**
 * Conservative repair strategy that asks for only the corrected value.
 */
export class DefaultOutputRepairStrategy implements OutputRepairStrategy {
  createMessages(request: OutputRepairRequest): readonly Message[] {
    return Object.freeze([
      ...request.messages,
      Object.freeze({
        content: [
          "The previous response did not match the required output schema.",
          "Return only corrected JSON with no markdown or commentary.",
          "Validation issues:",
          ...request.issues.map((issue) => `- ${formatIssue(issue)}`),
          "Previous response:",
          request.rawOutput,
        ].join("\n"),
        role: MessageRole.User,
      }),
    ]);
  }
}

/**
 * Coordinates parsing, validation, and model-assisted repair for final output.
 */
export class StructuredOutputManager {
  readonly #parser: OutputParser;
  readonly #validator: OutputValidator;
  readonly #repairStrategy: OutputRepairStrategy;
  readonly #retryPolicy: RetryPolicy;

  constructor(config: StructuredOutputManagerConfig = {}) {
    this.#parser = config.parser ?? new JsonOutputParser();
    this.#validator = config.validator ?? new SchemaOutputValidator();
    this.#repairStrategy = config.repairStrategy ?? new DefaultOutputRepairStrategy();
    this.#retryPolicy = Object.freeze({
      maxRetries: config.retryPolicy?.maxRetries ?? 2,
    });
  }

  /**
   * Parses, validates, and repairs a final provider response when needed.
   */
  async process<TOutput>(
    request: StructuredOutputRequest<TOutput>
  ): Promise<StructuredOutputResult<TOutput>> {
    const retryPolicy = Object.freeze({
      maxRetries: request.retryPolicy?.maxRetries ?? this.#retryPolicy.maxRetries,
    });
    let response = toProviderResponse(request.rawOutput);
    let messages = request.messages;
    let rawOutput = request.rawOutput;
    let repairAttempts = 0;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt += 1) {
      await request.events?.validationStarted(attempt);
      const validation = this.#validator.validate(
        request.schema,
        this.#parser.parse(rawOutput),
        request.providerContext
      );

      if (validation.success) {
        await request.events?.validationSucceeded(attempt);
        return Object.freeze({
          messages,
          output: validation.value,
          repairAttempts,
          response,
        });
      }

      await request.events?.validationFailed(attempt, validation.issues);

      if (attempt === retryPolicy.maxRetries) {
        await request.events?.repairFailed(repairAttempts, validation.error);
        throw validation.error;
      }

      repairAttempts += 1;
      await request.events?.repairStarted(repairAttempts, validation.issues);
      messages = this.#repairStrategy.createMessages(
        Object.freeze({
          attempt: repairAttempts,
          issues: validation.issues,
          messages,
          rawOutput,
        })
      );
      response = await request.provider.generate(
        toRepairProviderRequest(messages, request.instructions),
        request.providerContext
      );
      rawOutput = response.message.content;
      messages = Object.freeze([...messages, response.message]);
      await request.events?.repairCompleted(repairAttempts);
    }

    throw new ValidationError({
      code: ShiroErrorCode.Validation,
      message: "Structured output validation failed.",
      runId: request.providerContext.runId,
    });
  }
}

/**
 * Dependencies used by StructuredOutputManager.
 */
export interface StructuredOutputManagerConfig {
  readonly parser?: OutputParser;
  readonly validator?: OutputValidator;
  readonly repairStrategy?: OutputRepairStrategy;
  readonly retryPolicy?: RetryPolicy;
}

type MutableValidationErrorDetails = {
  -readonly [Key in keyof ShiroErrorDetails]: ShiroErrorDetails[Key];
};

function toRepairProviderRequest(
  messages: readonly Message[],
  instructions: string | undefined
): { readonly messages: readonly Message[]; readonly instructions?: string } {
  const request: Partial<{ messages: readonly Message[]; instructions: string }> = {
    messages,
  };

  if (instructions !== undefined) {
    request.instructions = instructions;
  }

  return Object.freeze(request) as {
    readonly messages: readonly Message[];
    readonly instructions?: string;
  };
}

function toProviderResponse(rawOutput: string): ProviderResponse {
  return Object.freeze({
    message: Object.freeze({
      content: rawOutput,
      role: MessageRole.Assistant,
    }),
  });
}

function normalizeValidationIssues(error: unknown): readonly ValidationIssue[] {
  if (isZodError(error)) {
    return Object.freeze(
      error.issues.map((issue) =>
        Object.freeze({
          message: issue.message,
          path: Object.freeze(
            issue.path.flatMap((entry) =>
              typeof entry === "string" || typeof entry === "number" ? [entry] : []
            )
          ),
        })
      )
    );
  }

  if (error instanceof Error) {
    return Object.freeze([
      Object.freeze({
        message: error.message,
        path: Object.freeze([]),
      }),
    ]);
  }

  return Object.freeze([
    Object.freeze({
      message: "Output did not satisfy the configured schema.",
      path: Object.freeze([]),
    }),
  ]);
}

function isZodError(error: unknown): error is ZodLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { readonly issues?: unknown }).issues)
  );
}

interface ZodLikeError {
  readonly issues: readonly ZodLikeIssue[];
}

interface ZodLikeIssue {
  readonly message: string;
  readonly path: readonly PropertyKey[];
}

function formatValidationMessage(issues: readonly ValidationIssue[]): string {
  return `Structured output validation failed: ${issues.map(formatIssue).join("; ")}`;
}

function formatIssue(issue: ValidationIssue): string {
  const path = issue.path.length === 0 ? "<root>" : issue.path.join(".");
  return `${path}: ${issue.message}`;
}
