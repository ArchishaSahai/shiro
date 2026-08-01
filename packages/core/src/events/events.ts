import type { ShiroError } from "../errors/index.js";
import type { Message, Metadata } from "../shared/index.js";
import type { ToolCallRequest, ToolCallResult } from "../tool/index.js";

/**
 * Stable event names emitted by Shiro.
 */
export enum ShiroEventType {
  AgentStarted = "agent.started",
  RunStarted = "run.started",
  ProviderStarted = "provider.started",
  ProviderFinished = "provider.finished",
  ToolRequested = "tool.requested",
  ToolStarted = "tool.started",
  ToolFinished = "tool.finished",
  ToolCompleted = "tool.completed",
  ToolFailed = "tool.failed",
  ToolTimedOut = "tool.timed_out",
  ApprovalRequested = "approval.requested",
  ApprovalGranted = "approval.granted",
  ApprovalRejected = "approval.rejected",
  GuardrailChecked = "guardrail.checked",
  GuardrailViolated = "guardrail.violated",
  MemoryRead = "memory.read",
  MemoryUpdated = "memory.updated",
  HandoffRequested = "handoff.requested",
  HandoffCompleted = "handoff.completed",
  RunCompleted = "run.completed",
  RunFailed = "run.failed",
}

/**
 * Base shape shared by all Shiro lifecycle events.
 */
export interface BaseShiroEvent {
  readonly type: ShiroEventType;
  readonly runId: string;
  readonly timestamp: Date;
  readonly metadata?: Metadata;
}

export interface AgentStartedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.AgentStarted;
  readonly agentName: string;
}

export interface RunStartedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.RunStarted;
  readonly input: string | Message;
}

export interface ProviderStartedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ProviderStarted;
  readonly providerName: string;
}

export interface ProviderFinishedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ProviderFinished;
  readonly providerName: string;
}

export interface ToolStartedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolStarted;
  readonly toolCall: ToolCallRequest;
}

export interface ToolRequestedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolRequested;
  readonly toolCall: ToolCallRequest;
}

export interface ToolFinishedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolFinished;
  readonly result: ToolCallResult;
}

export interface ToolCompletedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolCompleted;
  readonly result: ToolCallResult;
}

export interface ToolFailedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolFailed;
  readonly result: ToolCallResult;
}

export interface ToolTimedOutEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ToolTimedOut;
  readonly result: ToolCallResult;
}

export interface ApprovalRequestedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ApprovalRequested;
  readonly toolCall: ToolCallRequest;
}

export interface ApprovalGrantedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ApprovalGranted;
}

export interface ApprovalRejectedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.ApprovalRejected;
  readonly reason?: string;
}

export interface GuardrailCheckedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.GuardrailChecked;
  readonly guardrailName: string;
}

export interface GuardrailViolatedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.GuardrailViolated;
  readonly guardrailName: string;
  readonly reason?: string;
}

export interface MemoryReadEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.MemoryRead;
  readonly recordCount: number;
}

export interface MemoryUpdatedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.MemoryUpdated;
  readonly recordCount: number;
}

export interface HandoffRequestedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.HandoffRequested;
  readonly targetAgent?: string;
}

export interface HandoffCompletedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.HandoffCompleted;
  readonly targetAgent: string;
}

export interface RunCompletedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.RunCompleted;
}

export interface RunFailedEvent extends BaseShiroEvent {
  readonly type: ShiroEventType.RunFailed;
  readonly error: ShiroError;
}

/**
 * Union of all public Shiro event payloads.
 */
export type ShiroEvent =
  | AgentStartedEvent
  | RunStartedEvent
  | ProviderStartedEvent
  | ProviderFinishedEvent
  | ToolRequestedEvent
  | ToolStartedEvent
  | ToolFinishedEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | ToolTimedOutEvent
  | ApprovalRequestedEvent
  | ApprovalGrantedEvent
  | ApprovalRejectedEvent
  | GuardrailCheckedEvent
  | GuardrailViolatedEvent
  | MemoryReadEvent
  | MemoryUpdatedEvent
  | HandoffRequestedEvent
  | HandoffCompletedEvent
  | RunCompletedEvent
  | RunFailedEvent;

/**
 * Event payload narrowed by event type.
 */
export type EventByType<TType extends ShiroEventType> = Extract<
  ShiroEvent,
  { readonly type: TType }
>;

/**
 * Subscription cleanup handle.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Handler for a typed Shiro event.
 */
export type EventHandler<TType extends ShiroEventType> = (
  event: EventByType<TType>
) => void | Promise<void>;

/**
 * Typed publish/subscribe contract for lifecycle events.
 */
export interface EventBus {
  publish(event: ShiroEvent): void | Promise<void>;
  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable;
}
