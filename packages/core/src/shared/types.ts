/**
 * JSON-compatible primitive values.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-compatible object, array, or primitive value.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * JSON-compatible object shape.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * JSON-compatible array shape.
 */
export type JsonArray = readonly JsonValue[];

/**
 * String-keyed metadata safe to expose to userland integrations.
 */
export type Metadata = Readonly<Record<string, JsonValue>>;

/**
 * Unique identifier used by Shiro resources.
 */
export type ResourceId = string;

/**
 * Role assigned to a conversational message.
 */
export enum MessageRole {
  System = "system",
  User = "user",
  Assistant = "assistant",
  Tool = "tool",
}

/**
 * A message stored in a session or sent to a provider.
 */
export interface Message {
  readonly id?: ResourceId;
  readonly role: MessageRole;
  readonly content: string;
  readonly name?: string;
  readonly createdAt?: Date;
  readonly metadata?: Metadata;
}

/**
 * Reason an agent run reached a terminal state.
 */
export enum FinishReason {
  Completed = "completed",
  Cancelled = "cancelled",
  Failed = "failed",
  GuardrailBlocked = "guardrail_blocked",
  ApprovalRejected = "approval_rejected",
  HandedOff = "handed_off",
}

/**
 * Cooperative cancellation signal accepted by Shiro contracts.
 */
export interface CancellationOptions {
  readonly signal?: AbortSignal;
}

/**
 * Common timeout configuration in milliseconds.
 */
export interface TimeoutOptions {
  readonly timeoutMs?: number;
}
