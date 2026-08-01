import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import { Agent, Engine, tool, type JsonObject, type ToolSchema } from "@shiro/core";
import { OpenAIPlugin } from "@shiro/openai";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const apiKey = process.env.OPENAI_API_KEY;

if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error("OPENAI_API_KEY is required to run the basic agent example.");
}

const engine = new Engine();

engine.use(
  new OpenAIPlugin({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  })
);

interface WeatherInput extends JsonObject {
  readonly location: string;
}

const weatherSchema: ToolSchema<WeatherInput> = {
  parse(input: unknown): WeatherInput {
    if (!isObject(input) || typeof input.location !== "string") {
      throw new Error("location is required.");
    }

    return Object.freeze({
      location: input.location,
    });
  },
  toJSONSchema(): JsonObject {
    return Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({
        location: Object.freeze({
          description: "City or region for the weather lookup.",
          type: "string",
        }),
      }),
      required: Object.freeze(["location"]),
      type: "object",
    });
  },
};

const weatherTool = tool({
  description: "Returns the current weather for a location.",
  execute: async ({ location }) => {
    await Promise.resolve();
    return Object.freeze({
      condition: "sunny",
      location,
      temperatureC: 28,
    });
  },
  name: "weather",
  parameters: weatherSchema,
});

const agent = new Agent({
  instructions: "You are a helpful AI assistant.",
  name: "Assistant",
  provider: "openai",
  tools: [weatherTool],
});

const result = await engine.execute(
  agent,
  "What is the weather in Pune today? Use the weather tool before answering."
);

console.log(result.output);

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
