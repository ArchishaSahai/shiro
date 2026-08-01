import type { Agent, RunResult } from "../agent/index.js";
import { ApprovalDecisionStatus, type ApprovalContext } from "../approval/index.js";
import { ConfigurationError, RuntimeError, ShiroError, ShiroErrorCode } from "../errors/index.js";
import { ShiroEventType, type ShiroEvent } from "../events/index.js";
import { HandoffDecisionStatus, HandoffManager, type HandoffContext } from "../handoff/index.js";
import type {
  MemoryEntry,
  MemoryReadContext,
  MemoryRecord,
  MemoryWriteContext,
} from "../memory/index.js";
import type { ProviderResponse } from "../provider/index.js";
import type { RunContext } from "../runtime/index.js";
import { createSessionSnapshot, type SessionSnapshot } from "../session/index.js";
import { FinishReason, MessageRole, type Message, type Metadata } from "../shared/index.js";
import type { JsonObject } from "../shared/index.js";
import {
  ToolExecutionState,
  ToolExecutor,
  ToolRegistry,
  ToolSerializer,
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
export class Runner<TOutput = string> {
  readonly #dependencies: RunnerDependencies;
  #activeAgent: Agent<unknown>;
  #handoffManager: HandoffManager | undefined;
  #toolRegistry: ToolRegistry | undefined;
  #toolExecutor: ToolExecutor | undefined;
  readonly #toolSerializer = new ToolSerializer();
  #state = RunnerState.Created;
  #stage = PipelineStage.Created;
  #messages: readonly Message[] = [];
  #session: SessionSnapshot | null = null;
  #memory: readonly MemoryEntry[] = [];
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
  async execute(): Promise<RunResult<TOutput>> {
    try {
      await this.#initializeStage();
      await this.#validateStage();
      this.#resolveProviderStage();
      await this.#prepareMessagesStage();
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

  async #prepareMessagesStage(): Promise<void> {
    this.#setStage(PipelineStage.PrepareMessages);
    this.#throwIfCancelled();
    const history = await this.#loadSessionHistory();
    this.#memory = await this.#retrieveMemory();
    const memoryMessages = this.#memory.map((entry) => toMemoryMessage(entry));
    const context = await this.context.engine.contextCompactor?.compact([
      ...history,
      ...memoryMessages,
      toUserMessage(this.#dependencies.input),
    ]);
    this.#messages = Object.freeze(context?.messages ?? [toUserMessage(this.#dependencies.input)]);

    if (context?.compacted === true) {
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.MemoryCompacted),
        messageCount: this.#messages.length,
      });
    }

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.ContextPrepared),
      messageCount: this.#messages.length,
    });
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

  async #finalizeStage(): Promise<RunResult<TOutput>> {
    this.#setStage(PipelineStage.Finalize);
    this.#throwIfCancelled();
    const output = await this.#prepareStructuredOutput();
    this.complete();

    const result = this.#createResult(FinishReason.Completed, output);
    await this.#persistSession();
    await this.#persistMemory();

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunCompleted),
    });

    return result;
  }

  async #cancelExecution(): Promise<RunResult<TOutput>> {
    if (!isTerminalRunnerState(this.#state)) {
      this.cancel();
    }

    const result = this.#createResult(
      FinishReason.Cancelled,
      (this.#providerResponse?.message.content ?? "") as TOutput
    );

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.RunCompleted),
    });

    return result;
  }

  #createResult(finishReason: FinishReason, output: TOutput): RunResult<TOutput> {
    return Object.freeze({
      context: this.context,
      finishReason,
      messages: this.#messages,
      output,
      runId: this.runId,
    });
  }

  async #prepareStructuredOutput(): Promise<TOutput> {
    const rawOutput = this.#providerResponse?.message.content ?? "";
    const schema = this.#activeAgent.output;

    if (schema === undefined) {
      return rawOutput as TOutput;
    }

    const manager = this.context.engine.structuredOutputManager;

    if (manager === undefined) {
      throw new RuntimeError({
        code: ShiroErrorCode.Runtime,
        message: "Structured output schema was configured but no output manager is available.",
        runId: this.runId,
      });
    }

    const result = await manager.process({
      events: {
        repairCompleted: async (attempt) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputRepairCompleted),
            attempt,
          });
        },
        repairFailed: async (attempt, error) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputRepairFailed),
            attempt,
            error,
          });
        },
        repairStarted: async (attempt, issues) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputRepairStarted),
            attempt,
            issueCount: issues.length,
          });
        },
        validationFailed: async (attempt, issues) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputValidationFailed),
            attempt,
            issueCount: issues.length,
          });
        },
        validationStarted: async (attempt) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputValidationStarted),
            attempt,
          });
        },
        validationSucceeded: async (attempt) => {
          await this.#publish({
            ...this.#baseEvent(ShiroEventType.OutputValidationSucceeded),
            attempt,
          });
        },
      },
      instructions: this.#activeAgent.instructions,
      messages: this.#messages,
      provider: this.context.engine.provider,
      providerContext: this.#providerContext(),
      rawOutput,
      schema,
    });

    this.#messages = result.messages;
    this.#providerResponse = result.response;
    return result.output as TOutput;
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

  async #loadSessionHistory(): Promise<readonly Message[]> {
    const sessionManager = this.context.engine.sessionManager;

    if (sessionManager === undefined) {
      return Object.freeze([]);
    }

    if (this.context.sessionId === undefined) {
      this.#session = await sessionManager.createSession(this.context.metadata);
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.SessionCreated),
        sessionId: this.#session.sessionId,
      });
      return Object.freeze([]);
    }

    this.#session = await sessionManager.getSession(this.context.sessionId);

    if (this.#session === null) {
      this.#session = await sessionManager.updateSession(
        createSessionSnapshot(
          this.context.sessionId,
          [],
          this.#activeAgent.name,
          null,
          this.context.metadata
        )
      );
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.SessionCreated),
        sessionId: this.#session.sessionId,
      });
      return Object.freeze([]);
    }

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.SessionLoaded),
      sessionId: this.#session.sessionId,
    });
    return this.#session.messages;
  }

  async #retrieveMemory(): Promise<readonly MemoryEntry[]> {
    const memoryManager = this.context.engine.memoryManager;

    if (memoryManager === undefined) {
      return Object.freeze([]);
    }

    const readContext: Partial<MutableMemoryReadContext> = {
      input: this.#dependencies.input,
      runId: this.runId,
    };
    const sessionId = this.#session?.sessionId ?? this.context.sessionId;

    if (sessionId !== undefined) {
      readContext.sessionId = sessionId;
    }

    if (this.context.metadata !== undefined) {
      readContext.metadata = this.context.metadata;
    }

    const entries = await memoryManager.retrieve(readContext as MutableMemoryReadContext);

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.MemoryRetrieved),
      recordCount: entries.length,
    });
    return entries;
  }

  async #persistSession(): Promise<void> {
    const sessionManager = this.context.engine.sessionManager;
    const sessionId = this.#session?.sessionId ?? this.context.sessionId;

    if (sessionManager === undefined || sessionId === undefined) {
      return;
    }

    this.#session = await sessionManager.updateSession(
      createSessionSnapshot(
        sessionId,
        this.#messages,
        this.#activeAgent.name,
        this.#session,
        this.context.metadata
      )
    );
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.SessionUpdated),
      sessionId,
    });
  }

  async #persistMemory(): Promise<void> {
    const memoryManager = this.context.engine.memoryManager;

    if (memoryManager === undefined || this.#providerResponse === undefined) {
      return;
    }

    const record: Partial<MutableMemoryRecord> = {
      content: this.#providerResponse.message.content,
    };
    const writeContext: Partial<MutableMemoryWriteContext> = {
      runId: this.runId,
    };
    const sessionId = this.#session?.sessionId ?? this.context.sessionId;

    if (this.context.metadata !== undefined) {
      record.metadata = this.context.metadata;
      writeContext.metadata = this.context.metadata;
    }

    if (sessionId !== undefined) {
      writeContext.sessionId = sessionId;
    }

    await memoryManager.store(
      record as MutableMemoryRecord,
      writeContext as MutableMemoryWriteContext
    );
    await this.#publish({
      ...this.#baseEvent(ShiroEventType.MemoryStored),
      recordCount: 1,
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

        const approvalResult = await this.#approveToolCall(toolCall);

        if (approvalResult !== undefined) {
          await this.#publishToolResult(approvalResult);
          return approvalResult;
        }

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

  async #approveToolCall(toolCall: ToolCall): Promise<ToolResult | undefined> {
    const approvalManager = this.context.engine.approvalManager;
    const toolEntry = this.#toolRegistry?.resolve(toolCall.name);

    if (approvalManager === undefined || toolEntry === undefined) {
      return undefined;
    }

    const approvalContext = this.#approvalContext(toolEntry, toolCall);

    if (!(await approvalManager.requiresApproval(approvalContext))) {
      return undefined;
    }

    await this.#publish({
      ...this.#baseEvent(ShiroEventType.ApprovalRequested),
      toolCall,
    });

    const result = await approvalManager.requestApproval(approvalContext);
    const reason = result.decision.reason;

    if (result.approved) {
      await this.#publish({
        ...this.#baseEvent(ShiroEventType.ApprovalGranted),
        toolCall,
      });
      return undefined;
    }

    if (result.decision.status === ApprovalDecisionStatus.TimedOut) {
      await this.#publishApprovalDenied(ShiroEventType.ApprovalTimedOut, toolCall, reason);
    } else if (result.decision.status === ApprovalDecisionStatus.Cancelled) {
      await this.#publishApprovalDenied(ShiroEventType.ApprovalCancelled, toolCall, reason);
    } else {
      await this.#publishApprovalDenied(ShiroEventType.ApprovalRejected, toolCall, reason);
    }

    return this.#toolSerializer.serialize(
      toolCall,
      Object.freeze({
        approved: false,
        reason: reason ?? "Approval was not granted.",
      }),
      ToolExecutionState.Failed,
      0
    );
  }

  async #publishApprovalDenied(
    type:
      | ShiroEventType.ApprovalRejected
      | ShiroEventType.ApprovalTimedOut
      | ShiroEventType.ApprovalCancelled,
    toolCall: ToolCall,
    reason: string | undefined
  ): Promise<void> {
    const event: Partial<MutableApprovalDeniedEvent> = {
      ...this.#baseEvent(type),
      toolCall,
    };

    if (reason !== undefined) {
      event.reason = reason;
    }

    await this.#publish(event as MutableApprovalDeniedEvent);
  }

  #approvalContext(toolEntry: Tool, toolCall: ToolCall): ApprovalContext {
    const context: Partial<MutableApprovalContext> = {
      action: toolCall,
      agentName: this.#activeAgent.name,
      runId: this.runId,
      tool: toolEntry,
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

    return Object.freeze(context) as ApprovalContext;
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

type MutableApprovalContext = {
  -readonly [Key in keyof ApprovalContext]: ApprovalContext[Key];
};

type MutableMemoryReadContext = {
  -readonly [Key in keyof MemoryReadContext]: MemoryReadContext[Key];
};

type MutableMemoryWriteContext = {
  -readonly [Key in keyof MemoryWriteContext]: MemoryWriteContext[Key];
};

type MutableMemoryRecord = {
  -readonly [Key in keyof MemoryRecord]: MemoryRecord[Key];
};

interface MutableApprovalDeniedEvent {
  type:
    | ShiroEventType.ApprovalRejected
    | ShiroEventType.ApprovalTimedOut
    | ShiroEventType.ApprovalCancelled;
  runId: string;
  timestamp: Date;
  toolCall: ToolCall;
  reason?: string;
  metadata?: Metadata;
}

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

function toMemoryMessage(entry: MemoryEntry): Message {
  const message: Partial<MutableMessage> = {
    content: `Relevant memory: ${entry.content}`,
    role: MessageRole.System,
  };

  if (entry.metadata !== undefined) {
    message.metadata = entry.metadata;
  }

  return Object.freeze(message) as Message;
}

type MutableMessage = {
  -readonly [Key in keyof Message]: Message[Key];
};

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

function toAgentTool(agent: Agent<unknown>): Tool<AgentToolInput> {
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

function isAgent(value: unknown): value is Agent<unknown> {
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
