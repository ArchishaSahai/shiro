import type { Metadata } from "../shared/index.js";

/**
 * Decision produced by a guardrail check.
 */
export enum GuardrailDecision {
  Allow = "allow",
  Block = "block",
}

/**
 * Result returned from a guardrail.
 */
export interface GuardrailResult {
  readonly decision: GuardrailDecision;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Context passed to guardrails.
 */
export interface GuardrailContext {
  readonly runId: string;
  readonly agentName: string;
  readonly stage: GuardrailStage;
  readonly metadata?: Metadata;
}

/**
 * Lifecycle stage where a guardrail is evaluated.
 */
export enum GuardrailStage {
  Input = "input",
  ToolCall = "tool_call",
  Output = "output",
}

/**
 * Policy contract for validating inputs, outputs, or intermediate actions.
 */
export interface Guardrail<TTarget = unknown> {
  readonly name: string;
  check(target: TTarget, context: GuardrailContext): Promise<GuardrailResult>;
}
