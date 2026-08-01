export { Agent, AgentBuilder } from "./agent/index.js";
export type { AgentConfig, AgentOptions, RunOptions, RunResult } from "./agent/index.js";
export type {
  ApprovalContext,
  ApprovalDecision,
  ApprovalRequest,
  HumanApproval,
} from "./approval/index.js";
export { ApprovalDecisionStatus } from "./approval/index.js";
export {
  ApprovalRejectedError,
  ConfigurationError,
  GuardrailViolationError,
  HandoffError,
  MemoryError,
  MiddlewareError,
  PluginError,
  ProviderError,
  RuntimeError,
  SessionError,
  ShiroError,
  ShiroErrorCode,
  TimeoutError,
  ToolExecutionError,
  ToolNotFoundError,
  ValidationError,
} from "./errors/index.js";
export { Engine, EngineState, PipelineStage, Runner, RunnerState } from "./engine/index.js";
export type {
  AgentProviderResolver,
  EngineConfig,
  EngineContextFactory,
  EngineServices,
  EngineSnapshot,
  PipelineResult,
  RunInput,
  RunnerDependencies,
  RunnerOptions,
  RunnerSnapshot,
} from "./engine/index.js";
export type { ShiroErrorDetails } from "./errors/index.js";
export { ShiroEventType } from "./events/index.js";
export type {
  AgentStartedEvent,
  ApprovalGrantedEvent,
  ApprovalRejectedEvent,
  ApprovalRequestedEvent,
  BaseShiroEvent,
  Disposable,
  EventBus,
  EventByType,
  EventHandler,
  GuardrailCheckedEvent,
  GuardrailViolatedEvent,
  HandoffCompletedEvent,
  HandoffRequestedEvent,
  MemoryReadEvent,
  MemoryUpdatedEvent,
  ProviderFinishedEvent,
  ProviderStartedEvent,
  RunCompletedEvent,
  RunFailedEvent,
  RunStartedEvent,
  ShiroEvent,
  ToolFinishedEvent,
  ToolStartedEvent,
} from "./events/index.js";
export { GuardrailDecision, GuardrailStage } from "./guardrails/index.js";
export type { Guardrail, GuardrailContext, GuardrailResult } from "./guardrails/index.js";
export { HandoffDecisionStatus } from "./handoff/index.js";
export type { HandoffContext, HandoffDecision, HandoffStrategy } from "./handoff/index.js";
export type {
  MemoryProvider,
  MemoryReadContext,
  MemoryRecord,
  MemoryWriteContext,
} from "./memory/index.js";
export type { Middleware, MiddlewareContext, MiddlewareRunResult } from "./middleware/index.js";
export {
  DefaultPluginContext,
  PluginCapability,
  PluginLifecycle,
  PluginManager,
  PluginRegistry,
} from "./plugin/index.js";
export type {
  Plugin,
  PluginCapabilityDefinition,
  PluginContext,
  PluginContributions,
  PluginDependency,
  PluginEventListener,
  PluginLoader,
  PluginManagerConfig,
  PluginMetadata,
  PluginSnapshot,
  StudioExtension,
} from "./plugin/index.js";
export {
  BaseProvider,
  ProviderRegistry,
  RegistryProviderResolver,
  toProviderError,
} from "./provider/index.js";
export type {
  Provider,
  ProviderCapabilities,
  ProviderContext,
  ProviderFactory,
  ProviderFactoryConfig,
  ProviderMetadata,
  ProviderRequest,
  ProviderResolver,
  ProviderResponse,
} from "./provider/index.js";
export type { EngineContext, RunContext, RuntimeContext } from "./runtime/index.js";
export type { Session, SessionSnapshot, SessionStore } from "./session/index.js";
export { FinishReason, MessageRole } from "./shared/index.js";
export type {
  CancellationOptions,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Message,
  Metadata,
  ResourceId,
  TimeoutOptions,
} from "./shared/index.js";
export type {
  Tool,
  ToolCallRequest,
  ToolCallResult,
  ToolContext,
  ToolRegistry,
  ToolSchema,
} from "./tool/index.js";
export type { TraceAttributes, Tracer, TraceSpan } from "./tracing/index.js";
