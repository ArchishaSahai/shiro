import type { Metadata } from "../shared/index.js";

/**
 * Stable machine-readable error codes emitted by Shiro.
 */
export enum ShiroErrorCode {
  Configuration = "configuration_error",
  Validation = "validation_error",
  Runtime = "runtime_error",
  Provider = "provider_error",
  ToolExecution = "tool_execution_error",
  ToolNotFound = "tool_not_found_error",
  GuardrailViolation = "guardrail_violation_error",
  Session = "session_error",
  Memory = "memory_error",
  ApprovalRejected = "approval_rejected_error",
  Handoff = "handoff_error",
  Middleware = "middleware_error",
  Plugin = "plugin_error",
  Timeout = "timeout_error",
}

/**
 * Serializable shape shared by all Shiro errors.
 */
export interface ShiroErrorDetails {
  readonly code: ShiroErrorCode;
  readonly message: string;
  readonly runId?: string;
  readonly cause?: unknown;
  readonly metadata?: Metadata;
}

/**
 * Base error for all framework-level failures.
 */
export class ShiroError extends Error {
  readonly code: ShiroErrorCode;
  readonly runId: string | undefined;
  readonly metadata: Metadata | undefined;

  constructor(details: ShiroErrorDetails) {
    super(details.message, { cause: details.cause });
    this.name = "ShiroError";
    this.code = details.code;
    this.runId = details.runId;
    this.metadata = details.metadata;
  }
}

/** Configuration supplied to Shiro is invalid or incomplete. */
export class ConfigurationError extends ShiroError {}

/** User input or framework input failed validation. */
export class ValidationError extends ShiroError {}

/** A run failed inside Shiro orchestration. */
export class RuntimeError extends ShiroError {}

/** A model provider failed or returned an invalid response. */
export class ProviderError extends ShiroError {}

/** Tool execution failed. */
export class ToolExecutionError extends ShiroError {}

/** A requested tool was not registered or not available. */
export class ToolNotFoundError extends ShiroError {}

/** A guardrail blocked execution. */
export class GuardrailViolationError extends ShiroError {}

/** Session loading, saving, or mutation failed. */
export class SessionError extends ShiroError {}

/** Memory retrieval or persistence failed. */
export class MemoryError extends ShiroError {}

/** A required human approval was rejected. */
export class ApprovalRejectedError extends ShiroError {}

/** Human approval orchestration failed or denied execution. */
export class ApprovalError extends ShiroError {}

/** Agent handoff resolution failed. */
export class HandoffError extends ShiroError {}

/** Middleware failed while handling a lifecycle hook. */
export class MiddlewareError extends ShiroError {}

/** Plugin registration, loading, or lifecycle management failed. */
export class PluginError extends ShiroError {}

/** An operation exceeded its configured timeout. */
export class TimeoutError extends ShiroError {}
