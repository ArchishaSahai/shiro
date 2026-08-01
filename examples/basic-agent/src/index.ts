import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  Agent,
  ConsoleTraceExporter,
  Engine,
  JsonTraceExporter,
  ShiroEventType,
  TraceManager,
  type Disposable,
  type EventBus,
  type EventHandler,
  type ShiroEvent,
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

    if (event.type === ShiroEventType.SessionCreated) {
      console.log(`session created: ${event.sessionId}`);
    }

    if (event.type === ShiroEventType.SessionLoaded) {
      console.log(`session loaded: ${event.sessionId}`);
    }

    if (event.type === ShiroEventType.SessionUpdated) {
      console.log(`session updated: ${event.sessionId}`);
    }

    if (event.type === ShiroEventType.MemoryRetrieved) {
      console.log(`memory retrieved: ${String(event.recordCount)}`);
    }

    if (event.type === ShiroEventType.MemoryStored) {
      console.log(`memory stored: ${String(event.recordCount)}`);
    }

    if (event.type === ShiroEventType.ContextPrepared) {
      console.log(`context prepared: ${String(event.messageCount)} messages`);
    }

    if (event.type === ShiroEventType.OutputValidationFailed) {
      console.log(`output validation failed: ${String(event.issueCount)} issue(s)`);
    }

    if (event.type === ShiroEventType.OutputRepairCompleted) {
      console.log(`output repair completed: attempt ${String(event.attempt)}`);
    }
  }

  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable {
    void handler;

    return Object.freeze({
      dispose(): void {
        void type;
      },
    });
  }
}

const traceManager = new TraceManager({
  events: new ConsoleEventBus(),
});

const engine = new Engine({
  events: traceManager,
});

engine.use(
  new OpenAIPlugin({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  })
);

const weatherOutput = z.object({
  city: z.string(),
  condition: z.string(),
  temperature: z.number(),
});

const agent = new Agent({
  instructions:
    "You are a concise weather assistant. First answer naturally if unsure, then correct yourself when asked for valid JSON.",
  name: "Weather Assistant",
  output: weatherOutput,
  provider: "openai",
});

const result = await engine.execute(
  agent,
  "Give today's sample weather for Pune, India. Use 24 as the temperature and cloudy as the condition."
);

console.log(result.output.city);
console.log(result.output.temperature);
console.log(result.output.condition);

await traceManager.export(new ConsoleTraceExporter());
const traceJson = await traceManager.export(new JsonTraceExporter());
console.log(traceJson);
