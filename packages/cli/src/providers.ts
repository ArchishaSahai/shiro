/**
 * Provider → credential env var mapping.
 * Add a new entry here when introducing a provider; init/dev pick it up automatically.
 */

export type ProviderId = "openai" | "anthropic" | "google" | "groq" | "openrouter";

export interface ProviderCredential {
  readonly displayName: string;
  readonly envVar: string;
  readonly providerId: ProviderId;
  /** Lightweight auth check. Must never log or echo the key. */
  readonly verify?: (apiKey: string) => Promise<boolean>;
}

async function verifyBearerEndpoint(
  url: string,
  apiKey: string,
  extraHeaders?: Record<string, string>
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      method: "GET",
      signal: AbortSignal.timeout(12_000),
    });
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}

export const PROVIDER_CREDENTIALS: Readonly<Record<ProviderId, ProviderCredential>> = {
  anthropic: {
    displayName: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    providerId: "anthropic",
    verify: async (apiKey) => {
      try {
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
          method: "GET",
          signal: AbortSignal.timeout(12_000),
        });
        return response.status !== 401 && response.status !== 403;
      } catch {
        return false;
      }
    },
  },
  google: {
    displayName: "Google Gemini",
    envVar: "GOOGLE_API_KEY",
    providerId: "google",
    verify: async (apiKey) => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(12_000),
          }
        );
        return response.status !== 401 && response.status !== 403;
      } catch {
        return false;
      }
    },
  },
  groq: {
    displayName: "Groq",
    envVar: "GROQ_API_KEY",
    providerId: "groq",
    verify: (apiKey) => verifyBearerEndpoint("https://api.groq.com/openai/v1/models", apiKey),
  },
  openai: {
    displayName: "OpenAI",
    envVar: "OPENAI_API_KEY",
    providerId: "openai",
    verify: (apiKey) => verifyBearerEndpoint("https://api.openai.com/v1/models", apiKey),
  },
  openrouter: {
    displayName: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    providerId: "openrouter",
    verify: (apiKey) => verifyBearerEndpoint("https://openrouter.ai/api/v1/models", apiKey),
  },
};

export function getProviderCredential(providerId: string): ProviderCredential {
  if (isProviderId(providerId)) {
    return PROVIDER_CREDENTIALS[providerId];
  }
  return PROVIDER_CREDENTIALS.openai;
}

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDER_CREDENTIALS;
}
