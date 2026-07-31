import type { Metadata } from "../shared/index.js";
import type { ToolCallRequest } from "../tool/index.js";

/**
 * Human approval decision.
 */
export enum ApprovalDecisionStatus {
  Granted = "granted",
  Rejected = "rejected",
}

/**
 * Request sent to a human approval integration.
 */
export interface ApprovalRequest {
  readonly runId: string;
  readonly action: ToolCallRequest;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Context supplied when requesting approval.
 */
export interface ApprovalContext {
  readonly runId: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}

/**
 * Decision returned from a human approval integration.
 */
export interface ApprovalDecision {
  readonly status: ApprovalDecisionStatus;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Adapter for workflows requiring a human decision before continuing.
 */
export interface HumanApproval {
  request(request: ApprovalRequest, context: ApprovalContext): Promise<ApprovalDecision>;
}
