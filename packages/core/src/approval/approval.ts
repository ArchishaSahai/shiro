import {
  ApprovalError,
  ApprovalRejectedError,
  ShiroErrorCode,
  TimeoutError,
} from "../errors/index.js";
import type { Metadata } from "../shared/index.js";
import type { Tool, ToolCallRequest } from "../tool/index.js";

/**
 * Human approval decision.
 */
export enum ApprovalDecisionStatus {
  Granted = "granted",
  Rejected = "rejected",
  TimedOut = "timed_out",
  Cancelled = "cancelled",
}

/**
 * Context supplied when requesting approval.
 */
export interface ApprovalContext {
  readonly runId: string;
  readonly agentName: string;
  readonly tool: Tool;
  readonly action: ToolCallRequest;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}

/**
 * Request sent to a human approval provider.
 */
export interface ApprovalRequest {
  readonly id: string;
  readonly runId: string;
  readonly agentName: string;
  readonly toolName: string;
  readonly action: ToolCallRequest;
  readonly description?: string;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Raw response returned by an approval provider.
 */
export interface ApprovalResponse {
  readonly status: ApprovalDecisionStatus;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Normalized approval decision returned to orchestration.
 */
export interface ApprovalDecision extends ApprovalResponse {}

/**
 * Final approval result used by Runner.
 */
export interface ApprovalResult {
  readonly request: ApprovalRequest;
  readonly decision: ApprovalDecision;
  readonly approved: boolean;
}

/**
 * Evaluates whether a tool call requires human approval.
 */
export interface ApprovalPolicy {
  evaluate(context: ApprovalContext): boolean | Promise<boolean>;
}

/**
 * Provider abstraction for human approval surfaces.
 */
export interface ApprovalProvider {
  readonly name: string;
  request(request: ApprovalRequest, context: ApprovalContext): Promise<ApprovalResponse>;
}

/**
 * Adapter for workflows requiring a human decision before continuing.
 *
 * Compatibility alias for earlier contracts. Prefer ApprovalProvider in new code.
 */
export interface HumanApproval {
  request(request: ApprovalRequest, context: ApprovalContext): Promise<ApprovalDecision>;
}

/**
 * Registry of approval providers.
 */
export class ApprovalRegistry {
  readonly #providers = new Map<string, ApprovalProvider>();

  constructor(providers: readonly ApprovalProvider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /** Registers an approval provider. */
  register(provider: ApprovalProvider): void {
    if (provider.name.trim().length === 0) {
      throwApprovalError("Approval provider name is required.");
    }

    if (this.#providers.has(provider.name)) {
      throwApprovalError(`Approval provider "${provider.name}" is already registered.`);
    }

    this.#providers.set(provider.name, provider);
  }

  /** Removes an approval provider by name. */
  unregister(name: string): boolean {
    return this.#providers.delete(name);
  }

  /** Resolves an approval provider by name. */
  resolve(name: string): ApprovalProvider {
    const provider = this.#providers.get(name);

    if (provider === undefined) {
      throwApprovalError(`Approval provider "${name}" is not registered.`);
    }

    return provider;
  }

  /** Lists registered approval providers. */
  list(): readonly ApprovalProvider[] {
    return Object.freeze([...this.#providers.values()]);
  }
}

/**
 * Approval provider used for local development and tests.
 */
export class LocalApprovalProvider implements ApprovalProvider {
  readonly name = "local";
  readonly #decision: ApprovalDecisionStatus;

  constructor(decision: ApprovalDecisionStatus = ApprovalDecisionStatus.Granted) {
    this.#decision = decision;
  }

  /** Returns the configured local decision. */
  async request(): Promise<ApprovalResponse> {
    await Promise.resolve();
    return Object.freeze({
      status: this.#decision,
    });
  }
}

/**
 * Policy that always requires approval.
 */
export class AlwaysApprovePolicy implements ApprovalPolicy {
  evaluate(): boolean {
    return true;
  }
}

/**
 * Policy that never requires approval.
 */
export class NeverApprovePolicy implements ApprovalPolicy {
  evaluate(): boolean {
    return false;
  }
}

/**
 * Policy that requires approval for tools explicitly marked sensitive.
 */
export class SensitiveToolApprovalPolicy implements ApprovalPolicy {
  evaluate(context: ApprovalContext): boolean {
    return context.tool.requiresApproval === true;
  }
}

/**
 * Composes multiple approval policies with OR semantics.
 */
export class CompositeApprovalPolicy implements ApprovalPolicy {
  readonly #policies: readonly ApprovalPolicy[];

  constructor(policies: readonly ApprovalPolicy[]) {
    this.#policies = Object.freeze([...policies]);
  }

  /** Returns true when any policy requires approval. */
  async evaluate(context: ApprovalContext): Promise<boolean> {
    for (const policy of this.#policies) {
      if (await policy.evaluate(context)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Configuration for ApprovalManager.
 */
export interface ApprovalManagerConfig {
  readonly provider?: ApprovalProvider;
  readonly registry?: ApprovalRegistry;
  readonly policy?: ApprovalPolicy;
  readonly timeoutMs?: number;
  readonly defaultDecision?: ApprovalDecisionStatus;
}

/**
 * Coordinates HITL policy evaluation, provider calls, timeout, and cancellation.
 */
export class ApprovalManager {
  readonly #provider: ApprovalProvider;
  readonly #policy: ApprovalPolicy;
  readonly #timeoutMs: number | undefined;

  constructor(config: ApprovalManagerConfig = {}) {
    this.#provider =
      config.provider ??
      config.registry?.list()[0] ??
      new LocalApprovalProvider(config.defaultDecision ?? ApprovalDecisionStatus.Rejected);
    this.#policy = config.policy ?? new SensitiveToolApprovalPolicy();
    this.#timeoutMs = config.timeoutMs;
  }

  /** Returns true when the tool call requires approval. */
  async requiresApproval(context: ApprovalContext): Promise<boolean> {
    if (context.tool.approvalPolicy !== undefined) {
      return context.tool.approvalPolicy.evaluate(context);
    }

    return this.#policy.evaluate(context);
  }

  /** Creates and awaits an approval request. */
  async requestApproval(context: ApprovalContext): Promise<ApprovalResult> {
    const request = createApprovalRequest(context);

    try {
      const response = await withApprovalTimeout(
        this.#provider.request(request, context),
        this.#timeoutMs,
        context.signal
      );
      const decision = freezeDecision(response);

      return Object.freeze({
        approved: decision.status === ApprovalDecisionStatus.Granted,
        decision,
        request,
      });
    } catch (error) {
      const decision = toFailureDecision(error);

      return Object.freeze({
        approved: false,
        decision,
        request,
      });
    }
  }
}

function createApprovalRequest(context: ApprovalContext): ApprovalRequest {
  const request: Partial<MutableApprovalRequest> = {
    action: context.action,
    agentName: context.agentName,
    id: createApprovalId(),
    runId: context.runId,
    toolName: context.tool.name,
  };

  if (context.tool.approvalDescription !== undefined) {
    request.description = context.tool.approvalDescription;
  }

  if (context.metadata !== undefined) {
    request.metadata = context.metadata;
  }

  return Object.freeze(request) as ApprovalRequest;
}

type MutableApprovalRequest = {
  -readonly [Key in keyof ApprovalRequest]: ApprovalRequest[Key];
};

function freezeDecision(response: ApprovalResponse): ApprovalDecision {
  const decision: Partial<MutableApprovalDecision> = {
    status: response.status,
  };

  if (response.reason !== undefined) {
    decision.reason = response.reason;
  }

  if (response.metadata !== undefined) {
    decision.metadata = Object.freeze({ ...response.metadata });
  }

  return Object.freeze(decision) as ApprovalDecision;
}

type MutableApprovalDecision = {
  -readonly [Key in keyof ApprovalDecision]: ApprovalDecision[Key];
};

async function withApprovalTimeout<TValue>(
  operation: Promise<TValue>,
  timeoutMs: number | undefined,
  signal: AbortSignal | undefined
): Promise<TValue> {
  if (signal?.aborted === true) {
    throw new ApprovalError({
      code: ShiroErrorCode.ApprovalRejected,
      message: "Approval was cancelled.",
    });
  }

  if (timeoutMs === undefined) {
    return operation;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<TValue>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new TimeoutError({
              code: ShiroErrorCode.Timeout,
              message: `Approval exceeded ${String(timeoutMs)}ms.`,
            })
          );
        }, timeoutMs);

        if (signal !== undefined) {
          abortHandler = () => {
            reject(
              new ApprovalError({
                code: ShiroErrorCode.ApprovalRejected,
                message: "Approval was cancelled.",
              })
            );
          };
          signal.addEventListener("abort", abortHandler, { once: true });
        }
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    if (signal !== undefined && abortHandler !== undefined) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

function toFailureDecision(error: unknown): ApprovalDecision {
  if (error instanceof TimeoutError) {
    return Object.freeze({
      reason: error.message,
      status: ApprovalDecisionStatus.TimedOut,
    });
  }

  if (error instanceof ApprovalError || error instanceof ApprovalRejectedError) {
    return Object.freeze({
      reason: error.message,
      status: ApprovalDecisionStatus.Cancelled,
    });
  }

  return Object.freeze({
    reason: "Approval provider failed.",
    status: ApprovalDecisionStatus.Rejected,
  });
}

function createApprovalId(): string {
  return `approval_${crypto.randomUUID()}`;
}

function throwApprovalError(message: string): never {
  throw new ApprovalError({
    code: ShiroErrorCode.ApprovalRejected,
    message,
  });
}
