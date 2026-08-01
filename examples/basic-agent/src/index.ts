import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import {
  Agent,
  Engine,
  SequentialHandoffStrategy,
  ShiroEventType,
  tool,
  type Disposable,
  type EventBus,
  type EventHandler,
  type JsonObject,
  type ShiroEvent,
  type ToolSchema,
} from "@shiro/core";
import { OpenAIPlugin } from "@shiro/openai";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const apiKey = process.env.OPENAI_API_KEY;

if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error("OPENAI_API_KEY is required to run the basic agent example.");
}

class ConsoleEventBus implements EventBus {
  async publish(event: ShiroEvent): Promise<void> {
    await Promise.resolve();

    if (event.type === ShiroEventType.AgentHandoffCompleted) {
      console.log(`handoff: ${event.fromAgent} -> ${event.toAgent}`);
    }

    if (event.type === ShiroEventType.ToolCompleted) {
      console.log(`tool: ${event.result.name}`);
    }
  }

  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable {
    void type;
    void handler;

    return Object.freeze({
      dispose(): void {
        void type;
      },
    });
  }
}

const engine = new Engine({
  events: new ConsoleEventBus(),
});

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

const researchAgent = new Agent({
  handoff: new SequentialHandoffStrategy(["Manager"]),
  instructions:
    "You are a research agent. Use available tools to collect factual context, then summarize the result briefly.",
  name: "Research",
  provider: "openai",
  tools: [weatherTool],
});

const securityAgent = new Agent({
  handoff: new SequentialHandoffStrategy(["Manager"]),
  instructions:
    "You are a security review agent. Review the prior messages for obvious safety or reliability concerns, then respond briefly.",
  name: "Security",
  provider: "openai",
});

const agent = new Agent({
  handoff: new SequentialHandoffStrategy(["Research", "Security"]),
  instructions:
    "You are the manager agent. Coordinate specialist agents when needed and produce the final response when their work is complete.",
  name: "Manager",
  provider: "openai",
  tools: [researchAgent, securityAgent],
});

const result = await engine.execute(
  agent,
  "Find today's weather in Pune, have the security agent review the result, then give a final concise answer.",
  { maxIterations: 12 }
);

console.log(result.output);

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
