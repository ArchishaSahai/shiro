import {
  PluginCapability,
  type Plugin,
  type PluginContext,
  type PluginMetadata,
} from "@shiro/core";
import type { OpenAIProviderConfig } from "./config.js";
import { OpenAIProvider } from "./provider.js";

/**
 * Shiro plugin that registers the OpenAI provider.
 */
export class OpenAIPlugin implements Plugin {
  readonly #config: OpenAIProviderConfig;
  readonly metadata: PluginMetadata;

  constructor(config: OpenAIProviderConfig) {
    this.#config = Object.freeze({ ...config });
    this.metadata = Object.freeze({
      author: "Shiro",
      capabilities: Object.freeze([
        Object.freeze({
          name: "openai",
          type: PluginCapability.Provider,
        }),
      ]),
      description: "OpenAI Responses API provider for Shiro.",
      homepage: "https://platform.openai.com/docs/api-reference/responses",
      id: "@shiro/openai",
      keywords: Object.freeze(["openai", "provider", "responses"]),
      license: "MIT",
      name: "OpenAI",
      version: "0.0.0",
    });
  }

  /**
   * Registers the OpenAI provider with Shiro.
   */
  load(context: PluginContext): void {
    context.registerProvider(new OpenAIProvider(this.#config));
  }
}
