/**
 * Configuration for the OpenAI provider plugin.
 */
export interface OpenAIProviderConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly baseURL?: string;
  readonly organization?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
}

/**
 * Immutable normalized OpenAI provider configuration.
 */
export interface ResolvedOpenAIProviderConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly baseURL?: string;
  readonly organization?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
}

/**
 * Creates an immutable OpenAI provider configuration.
 */
export function resolveOpenAIProviderConfig(
  config: OpenAIProviderConfig
): ResolvedOpenAIProviderConfig {
  if (config.apiKey.trim().length === 0) {
    throw new Error("OpenAI API key is required.");
  }

  const resolved: Partial<MutableResolvedOpenAIProviderConfig> = {
    apiKey: config.apiKey,
    model: config.model ?? "gpt-5",
  };

  if (config.baseURL !== undefined) {
    resolved.baseURL = config.baseURL;
  }

  if (config.organization !== undefined) {
    resolved.organization = config.organization;
  }

  if (config.timeout !== undefined) {
    resolved.timeout = config.timeout;
  }

  if (config.maxRetries !== undefined) {
    resolved.maxRetries = config.maxRetries;
  }

  return Object.freeze(resolved) as ResolvedOpenAIProviderConfig;
}

type MutableResolvedOpenAIProviderConfig = {
  -readonly [Key in keyof ResolvedOpenAIProviderConfig]: ResolvedOpenAIProviderConfig[Key];
};
