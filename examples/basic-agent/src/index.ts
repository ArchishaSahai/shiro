import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import {
  Agent,
  Engine,
  InMemoryMemoryProvider,
  InMemorySessionStore,
  MemoryManager,
  SessionManager,
  ShiroEventType,
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

const sessionManager = new SessionManager(new InMemorySessionStore());
const memoryManager = new MemoryManager(new InMemoryMemoryProvider());
const session = await sessionManager.createSession();

const engine = new Engine({
  events: new ConsoleEventBus(),
  memoryManager,
  sessionManager,
});

engine.use(
  new OpenAIPlugin({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  })
);

const agent = new Agent({
  instructions:
    "You are a concise assistant. Use the conversation history and relevant memory when answering.",
  name: "Assistant",
  provider: "openai",
});

const first = await engine.execute(
  agent,
  "Remember that my Shiro project codename is Sakura. Reply with one short acknowledgement.",
  { sessionId: session.sessionId }
);

console.log(`first: ${first.output}`);

const second = await engine.execute(agent, "What is my Shiro project codename?", {
  sessionId: session.sessionId,
});

console.log(`second: ${second.output}`);
