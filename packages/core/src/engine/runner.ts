import { ConfigurationError, ShiroErrorCode } from "../errors/index.js";
import type { RunContext } from "../runtime/index.js";
import { isTerminalRunnerState, RunnerState } from "./lifecycle.js";
import type { RunnerDependencies, RunnerSnapshot } from "./types.js";

/**
 * Coordinates lifecycle state for exactly one agent execution.
 *
 * Runner does not execute providers, tools, memory, guardrails, tracing, approvals,
 * or handoffs in this phase. It only owns per-run state and transitions.
 */
export class Runner {
  readonly #dependencies: RunnerDependencies;
  #state = RunnerState.Created;

  constructor(dependencies: RunnerDependencies) {
    this.#dependencies = Object.freeze({ ...dependencies });
  }

  /** Unique run identifier. */
  get runId(): string {
    return this.#dependencies.context.runId;
  }

  /** Current runner lifecycle state. */
  get state(): RunnerState {
    return this.#state;
  }

  /** Immutable context for this run. */
  get context(): RunContext {
    return this.#dependencies.context;
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
      state: this.state,
    });
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

function throwInvalidTransition(from: RunnerState, to: RunnerState): never {
  throw new ConfigurationError({
    code: ShiroErrorCode.Configuration,
    message: `Invalid runner lifecycle transition from "${from}" to "${to}".`,
  });
}
