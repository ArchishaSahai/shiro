import type { Message, Metadata } from "../shared/index.js";
import type { ToolCallRequest } from "../tool/index.js";

/**
 * Normalized request sent from Shiro to a model provider.
 */
export interface ProviderRequest {
  readonly messages: readonly Message[];
  readonly instructions?: string;
  readonly tools?: readonly ToolCallRequest[];
  readonly metadata?: Metadata;
}

/**
 * Context passed to providers for observability and cancellation.
 */
export interface ProviderContext {
  readonly runId: string;
  readonly agentName: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}

/**
 * Normalized model response returned to Shiro.
 */
export interface ProviderResponse {
  readonly message: Message;
  readonly toolCalls?: readonly ToolCallRequest[];
  readonly metadata?: Metadata;
}

/**
 * Framework-agnostic abstraction over an LLM provider.
 */
export interface Provider {
  readonly name: string;
  generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResponse>;
}
