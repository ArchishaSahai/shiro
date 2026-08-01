/**
 * Lifecycle state for a long-lived orchestration engine.
 */
export enum EngineState {
  Created = "created",
  Starting = "starting",
  Ready = "ready",
  Stopping = "stopping",
  Stopped = "stopped",
  Failed = "failed",
}

/**
 * Lifecycle state for one agent execution.
 */
export enum RunnerState {
  Created = "created",
  Initializing = "initializing",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

/**
 * Sequential stages that make up one agent execution pipeline.
 */
export enum PipelineStage {
  Created = "created",
  Initialize = "initialize",
  Validate = "validate",
  ResolveProvider = "resolve_provider",
  PrepareMessages = "prepare_messages",
  ExecuteProvider = "execute_provider",
  ProcessResult = "process_result",
  Finalize = "finalize",
}

/**
 * Returns true when a runner state is terminal.
 */
export function isTerminalRunnerState(state: RunnerState): boolean {
  return (
    state === RunnerState.Completed ||
    state === RunnerState.Failed ||
    state === RunnerState.Cancelled
  );
}
