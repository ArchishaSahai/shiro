import { ConfigurationError, ShiroErrorCode } from "../errors/index.js";
import type { JsonArray, JsonObject, JsonValue } from "../shared/index.js";
import type { AgentConfig } from "./agent.js";

type MutableAgentConfig = {
  -readonly [Key in keyof AgentConfig]: AgentConfig[Key];
};

/**
 * Validates the public agent configuration contract.
 */
export function validateAgentConfig(config: AgentConfig): void {
  if (!isObject(config)) {
    throwConfigurationError("Agent configuration must be an object.");
  }

  assertNonEmptyString(config.name, "Agent name is required.");
  assertNonEmptyString(config.instructions, "Agent instructions are required.");

  if (typeof config.provider !== "string" && !isObject(config.provider)) {
    throwConfigurationError("Agent provider is required.");
  }

  if (typeof config.provider === "string") {
    assertNonEmptyString(config.provider, "Agent provider is required.");
  }

  assertOptionalArray(config.tools, "Agent tools must be an array.");
  assertOptionalArray(config.guardrails, "Agent guardrails must be an array.");
  assertOptionalArray(config.middleware, "Agent middleware must be an array.");
}

/**
 * Creates the immutable configuration snapshot stored by Agent.
 */
export function cloneAgentConfig(config: AgentConfig): AgentConfig {
  const snapshot: Partial<MutableAgentConfig> = {
    instructions: config.instructions,
    name: config.name,
    provider: config.provider,
  };

  if (config.tools !== undefined) {
    snapshot.tools = Object.freeze([...config.tools]);
  }

  if (config.guardrails !== undefined) {
    snapshot.guardrails = Object.freeze([...config.guardrails]);
  }

  if (config.middleware !== undefined) {
    snapshot.middleware = Object.freeze([...config.middleware]);
  }

  if (config.memory !== undefined) {
    snapshot.memory = config.memory;
  }

  if (config.sessionStore !== undefined) {
    snapshot.sessionStore = config.sessionStore;
  }

  if (config.tracer !== undefined) {
    snapshot.tracer = config.tracer;
  }

  if (config.events !== undefined) {
    snapshot.events = config.events;
  }

  if (config.humanApproval !== undefined) {
    snapshot.humanApproval = config.humanApproval;
  }

  if (config.handoff !== undefined) {
    snapshot.handoff = config.handoff;
  }

  if (config.metadata !== undefined) {
    snapshot.metadata = freezeJsonObject(config.metadata);
  }

  return Object.freeze(snapshot) as AgentConfig;
}

function assertNonEmptyString(value: unknown, message: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throwConfigurationError(message);
  }
}

function assertOptionalArray(value: unknown, message: string): void {
  if (value !== undefined && !Array.isArray(value)) {
    throwConfigurationError(message);
  }
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function throwConfigurationError(message: string): never {
  throw new ConfigurationError({
    code: ShiroErrorCode.Configuration,
    message,
  });
}

function freezeJsonObject(value: JsonObject): JsonObject {
  const entries = Object.entries(value).map(
    ([key, entry]) => [key, freezeJsonValue(entry)] as const
  );
  return Object.freeze(Object.fromEntries(entries));
}

function freezeJsonArray(value: JsonArray): JsonArray {
  return Object.freeze(value.map((entry) => freezeJsonValue(entry)));
}

function freezeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return freezeJsonArray(value);
  }

  if (isJsonObject(value)) {
    return freezeJsonObject(value);
  }

  return value;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
