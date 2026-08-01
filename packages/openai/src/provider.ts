import {
  BaseProvider,
  MessageRole,
  type Message,
  type ProviderContext,
  type ProviderMetadata,
  type ProviderRequest,
  type ProviderResponse,
} from "@shiro/core";
import OpenAI from "openai";
import type { ClientOptions } from "openai";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses";
import type { ResolvedOpenAIProviderConfig, OpenAIProviderConfig } from "./config.js";
import { resolveOpenAIProviderConfig } from "./config.js";
import { OpenAIErrorMapper } from "./error-mapper.js";

const OPENAI_PROVIDER_METADATA: ProviderMetadata = Object.freeze({
  capabilities: Object.freeze({
    embeddings: true,
    reasoning: true,
    streaming: true,
    structuredOutputs: true,
    toolCalling: true,
    vision: true,
  }),
  displayName: "OpenAI",
  id: "openai",
  supportedModels: Object.freeze(["gpt-5", "gpt-4.1", "gpt-4o", "gpt-4o-mini"]),
});

/**
 * OpenAI Responses API provider for Shiro.
 */
export class OpenAIProvider extends BaseProvider {
  readonly #config: ResolvedOpenAIProviderConfig;
  readonly #client: OpenAI;
  readonly #errorMapper = new OpenAIErrorMapper();

  constructor(config: OpenAIProviderConfig) {
    super(OPENAI_PROVIDER_METADATA);
    this.#config = resolveOpenAIProviderConfig(config);
    this.#client = createClient(this.#config);
  }

  /**
   * Generates one complete response using the OpenAI Responses API.
   */
  async generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResponse> {
    try {
      const response = await this.#client.responses.create(
        createResponseParams(request, this.#config, false),
        createRequestOptions(context)
      );

      return toProviderResponse(response);
    } catch (error) {
      throw this.#errorMapper.map(error);
    }
  }

  /**
   * Streams response deltas using the OpenAI Responses API.
   */
  async *stream(
    request: ProviderRequest,
    context: ProviderContext
  ): AsyncIterable<ProviderResponse> {
    try {
      const stream = await this.#client.responses.create(
        createResponseParams(request, this.#config, true),
        createRequestOptions(context)
      );

      let content = "";

      for await (const event of stream) {
        if (isTextDeltaEvent(event)) {
          content += event.delta;
          yield toProviderResponseFromText(content);
        }
      }
    } catch (error) {
      throw this.#errorMapper.map(error);
    }
  }
}

function createClient(config: ResolvedOpenAIProviderConfig): OpenAI {
  const options: ClientOptions = {
    apiKey: config.apiKey,
  };

  if (config.baseURL !== undefined) {
    options.baseURL = config.baseURL;
  }

  if (config.maxRetries !== undefined) {
    options.maxRetries = config.maxRetries;
  }

  if (config.organization !== undefined) {
    options.organization = config.organization;
  }

  if (config.timeout !== undefined) {
    options.timeout = config.timeout;
  }

  return new OpenAI(options);
}

function createResponseParams(
  request: ProviderRequest,
  config: ResolvedOpenAIProviderConfig,
  stream: false
): ResponseCreateParamsNonStreaming;
function createResponseParams(
  request: ProviderRequest,
  config: ResolvedOpenAIProviderConfig,
  stream: true
): ResponseCreateParamsStreaming;
function createResponseParams(
  request: ProviderRequest,
  config: ResolvedOpenAIProviderConfig,
  stream: boolean
): ResponseCreateParamsNonStreaming | ResponseCreateParamsStreaming {
  const base = {
    input: toResponsesInput(request.messages),
    model: config.model,
  };
  const params =
    request.instructions === undefined ? base : { ...base, instructions: request.instructions };

  return stream ? { ...params, stream: true } : { ...params, stream: false };
}

function createRequestOptions(context: ProviderContext) {
  return context.signal === undefined ? undefined : { signal: context.signal };
}

function toResponsesInput(messages: readonly Message[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

function toProviderResponse(response: Response): ProviderResponse {
  return toProviderResponseFromText(response.output_text);
}

function toProviderResponseFromText(content: string): ProviderResponse {
  return Object.freeze({
    message: Object.freeze({
      content,
      role: MessageRole.Assistant,
    }),
  });
}

function isTextDeltaEvent(event: ResponseStreamEvent): event is ResponseTextDeltaEvent {
  return event.type === "response.output_text.delta";
}
