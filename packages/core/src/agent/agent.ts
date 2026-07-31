import type { Guardrail } from "../guardrails/index.js";
import type { HandoffStrategy } from "../handoff/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Middleware } from "../middleware/index.js";
import type { Provider } from "../provider/index.js";
import type { RunContext } from "../runtime/index.js";
import type { SessionStore } from "../session/index.js";
import type {
  CancellationOptions,
  FinishReason,
  Message,
  Metadata,
  TimeoutOptions,
} from "../shared/index.js";
import type { Tool } from "../tool/index.js";
import type { Tracer } from "../tracing/index.js";
import type { HumanApproval } from "../approval/index.js";
import type { EventBus } from "../events/index.js";

/**
 * Immutable public definition for an agent.
 */
export interface AgentConfig {
  readonly name: string;
  readonly instructions: string;
  readonly provider: Provider;
  readonly tools?: readonly Tool[];
  readonly guardrails?: readonly Guardrail[];
  readonly middleware?: readonly Middleware[];
  readonly memory?: MemoryProvider;
  readonly sessionStore?: SessionStore;
  readonly tracer?: Tracer;
  readonly events?: EventBus;
  readonly humanApproval?: HumanApproval;
  readonly handoff?: HandoffStrategy;
  readonly metadata?: Metadata;
}

/**
 * Options used when constructing or deriving an agent.
 */
export interface AgentOptions {
  readonly metadata?: Metadata;
}

/**
 * Options for a single agent run.
 */
export interface RunOptions extends CancellationOptions, TimeoutOptions {
  readonly sessionId?: string;
  readonly metadata?: Metadata;
}

/**
 * Successful terminal result of an agent run.
 */
export interface RunResult<TOutput = string> {
  readonly runId: string;
  readonly output: TOutput;
  readonly messages: readonly Message[];
  readonly finishReason: FinishReason;
  readonly context: RunContext;
  readonly metadata?: Metadata;
}
