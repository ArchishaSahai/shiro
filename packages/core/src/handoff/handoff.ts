import type { Agent } from "../agent/index.js";
import { HandoffError, ShiroErrorCode } from "../errors/index.js";
import type { Message, Metadata } from "../shared/index.js";

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
  readonly activeAgent: Agent;
  readonly availableAgents: readonly Agent[];
  readonly history: readonly HandoffResult[];
  readonly messages: readonly Message[];
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
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

/**
 * Strategy modes supported by Shiro handoff orchestration.
 */
export enum HandoffStrategyType {
  Sequential = "sequential",
}

/**
 * Result of one agent handoff transition.
 */
export interface HandoffResult {
  readonly fromAgent: string;
  readonly toAgent: string;
  readonly depth: number;
  readonly reason?: string;
  readonly metadata?: Metadata;
}

/**
 * Immutable graph of agent handoff transitions within a run.
 */
export class AgentExecutionGraph {
  readonly #edges: readonly HandoffResult[];

  constructor(edges: readonly HandoffResult[] = []) {
    this.#edges = Object.freeze([...edges]);
  }

  /** Handoff transitions in insertion order. */
  get edges(): readonly HandoffResult[] {
    return this.#edges;
  }

  /** Returns true when a transition already exists. */
  hasTransition(fromAgent: string, toAgent: string): boolean {
    return this.#edges.some((edge) => edge.fromAgent === fromAgent && edge.toAgent === toAgent);
  }

  /** Returns a new graph with one appended handoff edge. */
  append(result: HandoffResult): AgentExecutionGraph {
    return new AgentExecutionGraph([...this.#edges, freezeHandoffResult(result)]);
  }
}

/**
 * Resolves agents by name.
 */
export interface AgentResolver {
  resolve(name: string): Agent;
}

/**
 * Registry of agents available for multi-agent orchestration.
 */
export class AgentRegistry implements AgentResolver {
  readonly #agents = new Map<string, Agent>();

  constructor(agents: readonly Agent[] = []) {
    for (const agent of agents) {
      this.registerAgent(agent);
    }
  }

  /** Registers an immutable agent by name. */
  registerAgent(agent: Agent): void {
    if (this.#agents.has(agent.name)) {
      throwHandoffError(`Agent "${agent.name}" is already registered.`);
    }

    this.#agents.set(agent.name, agent);
  }

  /** Removes a registered agent. */
  unregisterAgent(name: string): boolean {
    return this.#agents.delete(name);
  }

  /** Resolves a registered agent by name. */
  resolve(name: string): Agent {
    const agent = this.#agents.get(name);

    if (agent === undefined) {
      throwHandoffError(`Agent "${name}" is not registered.`);
    }

    return agent;
  }

  /** Returns true when an agent is registered. */
  has(name: string): boolean {
    return this.#agents.has(name);
  }

  /** Lists registered agents. */
  list(): readonly Agent[] {
    return Object.freeze([...this.#agents.values()]);
  }
}

/**
 * Enforces maximum handoff depth.
 */
export class HandoffDepthLimiter {
  readonly #maxDepth: number;

  constructor(maxDepth = 8) {
    this.#maxDepth = maxDepth;
  }

  /** Maximum allowed handoff depth. */
  get maxDepth(): number {
    return this.#maxDepth;
  }

  /** Throws if the next handoff would exceed the configured limit. */
  assertAllowed(depth: number): void {
    if (depth >= this.#maxDepth) {
      throwHandoffError(`Run exceeded maximum handoff depth of ${String(this.#maxDepth)}.`);
    }
  }
}

/**
 * Coordinates active-agent transitions for one run.
 */
export class HandoffManager {
  readonly #registry: AgentRegistry;
  readonly #depthLimiter: HandoffDepthLimiter;
  #graph = new AgentExecutionGraph();

  constructor(registry: AgentRegistry, depthLimiter = new HandoffDepthLimiter()) {
    this.#registry = registry;
    this.#depthLimiter = depthLimiter;
  }

  /** Current handoff graph snapshot. */
  get graph(): AgentExecutionGraph {
    return this.#graph;
  }

  /** Available registered agents. */
  get agents(): readonly Agent[] {
    return this.#registry.list();
  }

  /** Evaluates configured handoff strategy for the active agent. */
  async evaluate(context: HandoffContext): Promise<HandoffDecision> {
    if (context.activeAgent.handoff === undefined) {
      return Object.freeze({ status: HandoffDecisionStatus.Continue });
    }

    return context.activeAgent.handoff.evaluate(context);
  }

  /** Switches active agent after validating depth, cycles, and target availability. */
  handoff(fromAgent: Agent, targetAgent: string, reason?: string, metadata?: Metadata): Agent {
    this.#depthLimiter.assertAllowed(this.#graph.edges.length);
    const next = this.#registry.resolve(targetAgent);

    if (fromAgent.name === next.name) {
      throwHandoffError(`Agent "${fromAgent.name}" cannot hand off to itself.`);
    }

    const handoffResult: Partial<MutableHandoffResult> = {
      depth: this.#graph.edges.length + 1,
      fromAgent: fromAgent.name,
      toAgent: next.name,
    };

    if (reason !== undefined) {
      handoffResult.reason = reason;
    }

    if (metadata !== undefined) {
      handoffResult.metadata = metadata;
    }

    const result = freezeHandoffResult(handoffResult as HandoffResult);
    this.#graph = this.#graph.append(result);
    return next;
  }
}

/**
 * Sequential handoff strategy backed by an ordered target list.
 */
export class SequentialHandoffStrategy implements HandoffStrategy {
  readonly #targets: readonly string[];

  constructor(targets: readonly string[]) {
    this.#targets = Object.freeze([...targets]);
  }

  /** Returns the next not-yet-visited target. */
  async evaluate(context: HandoffContext): Promise<HandoffDecision> {
    await Promise.resolve();
    const visited = new Set(
      context.history
        .filter((item) => item.fromAgent === context.agentName)
        .map((item) => item.toAgent)
    );
    const target = this.#targets.find((candidate) => !visited.has(candidate));

    if (target === undefined) {
      return Object.freeze({ status: HandoffDecisionStatus.Continue });
    }

    return Object.freeze({
      status: HandoffDecisionStatus.Handoff,
      targetAgent: target,
    });
  }
}

function freezeHandoffResult(result: HandoffResult): HandoffResult {
  const snapshot: Partial<MutableHandoffResult> = {
    depth: result.depth,
    fromAgent: result.fromAgent,
    toAgent: result.toAgent,
  };

  if (result.reason !== undefined) {
    snapshot.reason = result.reason;
  }

  if (result.metadata !== undefined) {
    snapshot.metadata = Object.freeze({ ...result.metadata });
  }

  return Object.freeze(snapshot) as HandoffResult;
}

type MutableHandoffResult = {
  -readonly [Key in keyof HandoffResult]: HandoffResult[Key];
};

function throwHandoffError(message: string): never {
  throw new HandoffError({
    code: ShiroErrorCode.Handoff,
    message,
  });
}
