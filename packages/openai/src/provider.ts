import {
  BaseProvider,
  MessageRole,
  type Message,
  type ProviderContext,
  type ProviderMetadata,
  type ProviderRequest,
  type ProviderResponse,
  type Tool as ShiroTool,
  type ToolCallRequest,
  type JsonObject,
} from "@shiro-sdk/core";
import OpenAI from "openai";
import type { ClientOptions } from "openai";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseFunctionToolCall,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  Tool as OpenAITool,
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
  const paramsWithTools =
    request.tools === undefined || request.tools.length === 0
      ? params
      : { ...params, tools: request.tools.map(toOpenAITool) };

  return stream ? { ...paramsWithTools, stream: true } : { ...paramsWithTools, stream: false };
}

function createRequestOptions(context: ProviderContext) {
  return context.signal === undefined ? undefined : { signal: context.signal };
}

function toResponsesInput(messages: readonly Message[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

function toProviderResponse(response: Response): ProviderResponse {
  const toolCalls = response.output.flatMap((item) =>
    isFunctionToolCall(item) ? [toToolCallRequest(item)] : []
  );
  const message = Object.freeze({
    content: response.output_text,
    role: MessageRole.Assistant,
  });

  return Object.freeze(
    toolCalls.length === 0
      ? { message }
      : {
          message,
          toolCalls: Object.freeze(toolCalls),
        }
  );
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

function toOpenAITool(tool: ShiroTool): OpenAITool {
  const jsonSchema = tool.schema.toJSONSchema?.() ?? Object.freeze({ type: "object" });
  const definition = {
    name: tool.name,
    parameters: jsonSchema,
    strict: false,
    type: "function" as const,
  };

  return tool.description === undefined
    ? definition
    : { ...definition, description: tool.description };
}

function isFunctionToolCall(item: Response["output"][number]): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function toToolCallRequest(item: ResponseFunctionToolCall): ToolCallRequest {
  const parsedArguments = parseToolArguments(item.arguments);
  const call: Partial<MutableToolCallRequest> = {
    arguments: parsedArguments,
    id: item.call_id,
    name: item.name,
  };

  return Object.freeze(call) as ToolCallRequest;
}

type MutableToolCallRequest = {
  -readonly [Key in keyof ToolCallRequest]: ToolCallRequest[Key];
};

function parseToolArguments(value: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonObject(parsed) ? parsed : Object.freeze({});
  } catch {
    return Object.freeze({});
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
