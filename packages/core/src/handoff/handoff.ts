import type { Metadata } from "../shared/index.js";

/**
 * Handoff decision status.
 */
export enum HandoffDecisionStatus {
  Continue = "continue",
  Handoff = "handoff",
}

/**
 * Context used to evaluate whether a run should be handed off.
 */
export interface HandoffContext {
  readonly runId: string;
  readonly agentName: string;
  readonly sessionId?: string;
  readonly metadata?: Metadata;
}

/**
 * Decision produced by a handoff strategy.
 */
export interface HandoffDecision {
  readonly status: HandoffDecisionStatus;
  readonly targetAgent?: string;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Strategy for deciding when control should transfer to another agent.
 */
export interface HandoffStrategy {
  evaluate(context: HandoffContext): Promise<HandoffDecision>;
}
