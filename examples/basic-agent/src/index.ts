import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import { Agent, Engine } from "@shiro/core";
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

const agent = new Agent({
  instructions: "You are a helpful AI assistant.",
  name: "Assistant",
  provider: "openai",
});

const result = await engine.execute(agent, "Hello!");

console.log(result.output);
