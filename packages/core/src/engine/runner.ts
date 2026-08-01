import type { Agent, RunResult } from "../agent/index.js";
import { ConfigurationError, RuntimeError, ShiroError, ShiroErrorCode } from "../errors/index.js";
import { ShiroEventType, type ShiroEvent } from "../events/index.js";
import { HandoffDecisionStatus, HandoffManager, type HandoffContext } from "../handoff/index.js";
import type { ProviderResponse } from "../provider/index.js";
import type { RunContext } from "../runtime/index.js";
import { FinishReason, MessageRole, type Message, type Metadata } from "../shared/index.js";
import type { JsonObject } from "../shared/index.js";
import {
  ToolExecutionState,
  ToolExecutor,
  ToolRegistry,
  tool,
  type Tool,
  type ToolCall,
  type ToolContext,
  type ToolResult,
  type ToolSchema,
} from "../tool/index.js";
import { isTerminalRunnerState, PipelineStage, RunnerState } from "./lifecycle.js";
import type { RunnerDependencies, RunnerSnapshot } from "./types.js";

const DEFAULT_MAX_ITERATIONS = 8;

/**
 * Coordinates lifecycle state for exactly one agent execution.
 *
 * Runner does not execute providers, tools, memory, guardrails, tracing, approvals,
 * or handoffs in this phase. It only owns per-run state and transitions.
 */
export class Runner {
  readonly #dependencies: RunnerDependencies;
  #activeAgent: Agent;
  #handoffManager: HandoffManager | undefined;
  #toolRegistry: ToolRegistry | undefined;
  #toolExecutor: ToolExecutor | undefined;
  #state = RunnerState.Created;
  #stage = PipelineStage.Created;
  #messages: readonly Message[] = [];
  #providerResponse: ProviderResponse | undefined;
  #iteration = 0;

  constructor(dependencies: RunnerDependencies) {
    this.#dependencies = Object.freeze({ ...dependencies });
    this.#activeAgent = dependencies.agent;
  }

  /** Unique run identifier. */
  get runId(): string {
    return this.#dependencies.context.runId;
  }

  /** Current runner lifecycle state. */
  get state(): RunnerState {
    return this.#state;
  }

  /** Current pipeline stage. */
  get stage(): PipelineStage {
    return this.#stage;
  }

  /** Immutable context for this run. */
  get context(): RunContext {
    return this.#dependencies.context;
  }

  /**
   * Executes the internal orchestration pipeline for this run.
   *
   * Provider execution is intentionally a placeholder stage in this phase.
   */
  async execute(): Promise<RunResult> {
    try {
      await this.#initializeStage();
      await this.#validateStage();
      this.#resolveProviderStage();
      this.#prepareMessagesStage();
      await this.#executeProviderStage();
      this.#processResultStage();
      return await this.#finalizeStage();
    } catch (error) {
      if (this.context.signal?.aborted === true) {
        return this.#cancelExecution();
      }

      this.fail();
      await this.#publishRunFailed(toShiroError(error));
      throw error;
    }
  }

  /**
   * Moves the runner into the initializing state.
   */
  initialize(): void {
    this.#transition(RunnerState.Initializing, [RunnerState.Created]);
  }

  /**
   * Moves the runner into the running state.
   */
  start(): void {
    this.#transition(RunnerState.Running, [RunnerState.Initializing]);
  }

  /**
   * Marks the runner completed.
   */
  complete(): void {
    this.#transition(RunnerState.Completed, [RunnerState.Running]);
  }

  /**
   * Marks the runner failed.
   */
  fail(): void {
    this.#transition(RunnerState.Failed, [
      RunnerState.Created,
      RunnerState.Initializing,
      RunnerState.Running,
    ]);
  }

  /**
   * Marks the runner cancelled.
   */
  cancel(): void {
    this.#transition(RunnerState.Cancelled, [
      RunnerState.Created,
      RunnerState.Initializing,
      RunnerState.Running,
    ]);
  }

  /**
   * Returns a read-only snapshot of current runner state.
   */
  snapshot(): RunnerSnapshot {
    return Object.freeze({
      context: this.context,
      runId: this.runId,
      stage: this.stage,
      state: this.state,
    });
  }

  async #initializeStage(): Promise<void> {
    this.#setStage(PipelineStage.Initialize);
    this.#throwIfCancelled();
    this.initialize();
    this.#initializeMultiAgentServices();
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.AgentStarted),
      agentName: this.#activeAgent.name,
    });
  }

  async #validateStage(): Promise<void> {
    this.#setStage(PipelineStage.Validate);
    this.#throwIfCancelled();
    this.start();
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunStarted),
      input: this.#dependencies.input,
    });
  }

  #resolveProviderStage(): void {
    this.#setStage(PipelineStage.ResolveProvider);
    this.#throwIfCancelled();
  }

  #prepareMessagesStage(): void {
    this.#setStage(PipelineStage.PrepareMessages);
    this.#throwIfCancelled();
    this.#messages = Object.freeze([toUserMessage(this.#dependencies.input)]);
  }

  async #executeProviderStage(): Promise<void> {
    this.#setStage(PipelineStage.ExecuteProvider);
    this.#throwIfCancelled();
    const maxIterations = this.#dependencies.context.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    while (this.#iteration < maxIterations) {
      this.#iteration += 1;
      const response = await this.#callProvider();
      this.#providerResponse = response;
      this.#messages = Object.freeze([...this.#messages, response.message]);

      if (response.toolCalls === undefined || response.toolCalls.length === 0) {
        if (await this.#evaluateHandoff()) {
          continue;
        }

        return;
      }

      await this.#executeToolCalls(response.toolCalls);
      await this.#evaluateHandoff();
    }

    throw new RuntimeError({
      code: ShiroErrorCode.Runtime,
      message: `Run exceeded maximum iteration count of ${String(maxIterations)}.`,
      runId: this.runId,
    });
  }

  #processResultStage(): void {
    this.#setStage(PipelineStage.ProcessResult);
    this.#throwIfCancelled();
  }

  async #finalizeStage(): Promise<RunResult> {
    this.#setStage(PipelineStage.Finalize);
    this.#throwIfCancelled();
    this.complete();

    const result = this.#createResult(FinishReason.Completed);

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunCompleted),
    });

    return result;
  }

  async #cancelExecution(): Promise<RunResult> {
    if (!isTerminalRunnerState(this.#state)) {
      this.cancel();
    }

    const result = this.#createResult(FinishReason.Cancelled);

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunCompleted),
    });

    return result;
  }

  #createResult(finishReason: FinishReason): RunResult {
    return Object.freeze({
      context: this.context,
      finishReason,
      messages: this.#messages,
      output: this.#providerResponse?.message.content ?? "",
      runId: this.runId,
    });
  }

  async #publish(event: ShiroEvent): Promise<void> {
    await this.context.engine.events?.publish(event);
  }

  async #publishRunFailed(error: ShiroError): Promise<void> {
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunFailed),
      error,
    });
  }

  async #callProvider(): Promise<ProviderResponse> {
    const provider = this.context.engine.provider;
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.ProviderStarted),
      providerName: provider.name,
    });

    const request: Partial<MutableProviderRequest> = {
      instructions: this.#activeAgent.instructions,
      messages: this.#messages,
    };
    const tools = this.#shouldAdvertiseTools() ? this.#toolRegistry?.list() : undefined;

    if (tools !== undefined && tools.length > 0) {
      request.tools = tools;
    }

    const response = await provider.generate(
      request as MutableProviderRequest,
      this.#providerContext()
    );

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.ProviderFinished),
      providerName: provider.name,
    });

    return response;
  }

  async #executeToolCalls(toolCalls: readonly ToolCall[]): Promise<void> {
    const executor = this.#toolExecutor;

    if (executor === undefined) {
      throw new RuntimeError({
        code: ShiroErrorCode.Runtime,
        message: "Provider requested tool calls but no tool executor is available.",
        runId: this.runId,
      });
    }

    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        await this.#publish({
          ...this.#baseEvent(ShiroEventType.ToolRequested),
          toolCall,
        });
        await this.#publish({
          ...this.#baseEvent(ShiroEventType.ToolStarted),
          toolCall,
        });

        const result = await executor.execute(toolCall, this.#toolContext());
        await this.#publishToolResult(result);
        return result;
      })
    );

    this.#messages = Object.freeze([
      ...this.#messages,
      ...results.map((result) => toToolMessage(result)),
    ]);
  }

  async #publishToolResult(result: ToolResult): Promise<void> {
    if (result.state === ToolExecutionState.TimedOut) {
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.ToolTimedOut),
        result,
      });
      return;
    }

    if (result.state === ToolExecutionState.Completed) {
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.ToolCompleted),
        result,
      });
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.ToolFinished),
        result,
      });
      return;
    }

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.ToolFailed),
      result,
    });
  }

  #providerContext(): MutableProviderContext {
    const providerContext: Partial<MutableProviderContext> = {
      agentName: this.#activeAgent.name,
      runId: this.runId,
    };

    if (this.context.metadata !== undefined) {
      providerContext.metadata = this.context.metadata;
    }

    if (this.context.signal !== undefined) {
      providerContext.signal = this.context.signal;
    }

    return providerContext as MutableProviderContext;
  }

  #toolContext(): ToolContext {
    const context: Partial<MutableToolContext> = {
      agentName: this.#dependencies.agent.name,
      engine: this.context.engine,
      runId: this.runId,
    };

    if (this.context.sessionId !== undefined) {
      context.sessionId = this.context.sessionId;
    }

    if (this.context.signal !== undefined) {
      context.signal = this.context.signal;
    }

    if (this.context.metadata !== undefined) {
      context.metadata = this.context.metadata;
    }

    return Object.freeze(context) as ToolContext;
  }

  #shouldAdvertiseTools(): boolean {
    const lastMessage = this.#messages.at(-1);
    return lastMessage?.role !== MessageRole.Tool;
  }

  #initializeMultiAgentServices(): void {
    if (this.context.engine.agentRegistry !== undefined) {
      if (!this.context.engine.agentRegistry.has(this.#dependencies.agent.name)) {
        this.context.engine.agentRegistry.registerAgent(this.#dependencies.agent);
      }
      this.#handoffManager = new HandoffManager(
        this.context.engine.agentRegistry,
        this.context.engine.handoffDepthLimiter
      );
    }

    this.#refreshToolServices();
  }

  #refreshToolServices(): void {
    const tools = new ToolRegistry([
      ...this.#activeAgent.tools.flatMap((entry) => {
        if (!isAgent(entry)) {
          return [entry];
        }

        return this.#activeAgent.handoff === undefined ? [toAgentTool(entry)] : [];
      }),
    ]);

    if (tools.list().length > 0) {
      this.#toolRegistry = tools;
      this.#toolExecutor = new ToolExecutor(tools);
    }
  }

  async #evaluateHandoff(): Promise<boolean> {
    const agentToolTarget = getAgentToolTarget(this.#messages.at(-1));

    if (agentToolTarget !== undefined) {
      await this.#handoff(agentToolTarget, "Agent requested as tool.");
      return true;
    }

    const manager = this.#handoffManager;

    if (manager === undefined) {
      return false;
    }

    const handoffContext: Partial<MutableHandoffContext> = {
      activeAgent: this.#activeAgent,
      agentName: this.#activeAgent.name,
      availableAgents: manager.agents,
      history: manager.graph.edges,
      messages: this.#messages,
      runId: this.runId,
    };

    if (this.context.metadata !== undefined) {
      handoffContext.metadata = this.context.metadata;
    }

    if (this.context.sessionId !== undefined) {
      handoffContext.sessionId = this.context.sessionId;
    }

    if (this.context.signal !== undefined) {
      handoffContext.signal = this.context.signal;
    }

    const decision = await manager.evaluate(handoffContext as HandoffContext);

    if (decision.status === HandoffDecisionStatus.Handoff && decision.targetAgent !== undefined) {
      await this.#handoff(decision.targetAgent, decision.reason);
      return true;
    }

    return false;
  }

  async #handoff(targetAgent: string, reason: string | undefined): Promise<void> {
    const manager = this.#handoffManager;

    if (manager === undefined) {
      throw new RuntimeError({
        code: ShiroErrorCode.Runtime,
        message: "Agent handoff was requested but no agent registry is available.",
        runId: this.runId,
      });
    }

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.AgentHandoffRequested),
      fromAgent: this.#activeAgent.name,
      toAgent: targetAgent,
    });
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.AgentHandoffStarted),
      fromAgent: this.#activeAgent.name,
      toAgent: targetAgent,
    });

    try {
      const next = manager.handoff(this.#activeAgent, targetAgent, reason);
      const previous = this.#activeAgent.name;
      this.#activeAgent = next;
      this.#refreshToolServices();
      this.#messages = Object.freeze([
        ...this.#messages,
        Object.freeze({
          content: `Execution handed off from ${previous} to ${next.name}.`,
          role: MessageRole.System,
        }),
      ]);
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.AgentHandoffCompleted),
        fromAgent: previous,
        toAgent: next.name,
      });
    } catch (error) {
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.AgentHandoffFailed),
        error: toShiroError(error),
        fromAgent: this.#activeAgent.name,
        toAgent: targetAgent,
      });
      throw error;
    }
  }

  #baseEvent<TType extends ShiroEventType>(type: TType): BaseRunnerEvent<TType> {
    const event: Partial<MutableBaseRunnerEvent<TType>> = {
      runId: this.runId,
      timestamp: new Date(),
      type,
    };

    if (this.context.metadata !== undefined) {
      event.metadata = this.context.metadata;
    }

    return event as BaseRunnerEvent<TType>;
  }

  #throwIfCancelled(): void {
    if (this.context.signal?.aborted === true) {
      throw new RuntimeError({
        code: ShiroErrorCode.Runtime,
        message: "Run was cancelled.",
        runId: this.runId,
      });
    }
  }

  #setStage(stage: PipelineStage): void {
    this.#stage = stage;
  }

  #transition(next: RunnerState, allowedFrom: readonly RunnerState[]): void {
    if (isTerminalRunnerState(this.#state)) {
      throwInvalidTransition(this.#state, next);
    }

    if (!allowedFrom.includes(this.#state)) {
      throwInvalidTransition(this.#state, next);
    }

    this.#state = next;
  }
}

interface BaseRunnerEvent<TType extends ShiroEventType> {
  readonly type: TType;
  readonly runId: string;
  readonly timestamp: Date;
  readonly metadata?: Metadata;
}

type MutableBaseRunnerEvent<TType extends ShiroEventType> = {
  -readonly [Key in keyof BaseRunnerEvent<TType>]: BaseRunnerEvent<TType>[Key];
};

interface MutableProviderContext {
  agentName: string;
  runId: string;
  metadata?: Metadata;
  signal?: AbortSignal;
}

interface MutableProviderRequest {
  instructions: string;
  messages: readonly Message[];
  tools?: readonly Tool[];
}

type MutableToolContext = {
  -readonly [Key in keyof ToolContext]: ToolContext[Key];
};

type MutableHandoffContext = {
  -readonly [Key in keyof HandoffContext]: HandoffContext[Key];
};

function toUserMessage(input: RunnerDependencies["input"]): Message {
  if (typeof input !== "string") {
    return input;
  }

  return Object.freeze({
    content: input,
    role: MessageRole.User,
  });
}

function toToolMessage(result: ToolResult): Message {
  const metadata: Record<string, string | number> = {
    durationMs: result.durationMs,
    state: result.state,
  };

  if (result.toolCallId !== undefined) {
    metadata.toolCallId = result.toolCallId;
  }

  return Object.freeze({
    content: JSON.stringify(result.output),
    metadata: Object.freeze(metadata),
    name: result.name,
    role: MessageRole.Tool,
  });
}

function toShiroError(error: unknown): ShiroError {
  if (error instanceof ShiroError) {
    return error;
  }

  return new RuntimeError({
    cause: error,
    code: ShiroErrorCode.Runtime,
    message: "Runner execution failed.",
  });
}

function getAgentToolTarget(message: Message | undefined): string | undefined {
  if (message?.role !== MessageRole.Tool) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(message.content);

    if (!isRecord(parsed)) {
      return undefined;
    }

    return parsed.type === "agent_handoff" && typeof parsed.targetAgent === "string"
      ? parsed.targetAgent
      : undefined;
  } catch {
    return undefined;
  }
}

interface AgentToolInput extends JsonObject {
  readonly input?: string;
}

const agentToolSchema: ToolSchema<AgentToolInput> = Object.freeze({
  parse(input: unknown): AgentToolInput {
    if (!isRecord(input)) {
      return Object.freeze({});
    }

    return typeof input.input === "string"
      ? Object.freeze({ input: input.input })
      : Object.freeze({});
  },
  toJSONSchema(): JsonObject {
    return Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({
        input: Object.freeze({
          description: "Optional task or context for the target agent.",
          type: "string",
        }),
      }),
      type: "object",
    });
  },
});

function toAgentTool(agent: Agent): Tool<AgentToolInput> {
  return tool({
    description: `Hand off execution to the ${agent.name} agent.`,
    execute: async (input) => {
      await Promise.resolve();
      return Object.freeze({
        input: input.input ?? "",
        targetAgent: agent.name,
        type: "agent_handoff",
      });
    },
    name: agent.name,
    parameters: agentToolSchema,
  });
}

function isAgent(value: unknown): value is Agent {
  return (
    value instanceof Object && "name" in value && "instructions" in value && "provider" in value
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function throwInvalidTransition(from: RunnerState, to: RunnerState): never {
  throw new ConfigurationError({
    code: ShiroErrorCode.Configuration,
    message: `Invalid runner lifecycle transition from "${from}" to "${to}".`,
  });
}
