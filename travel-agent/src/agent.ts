import "dotenv/config";
import { Agent, Engine, TraceManager, connectStudio } from "@shiro-sdk/core";
import { OpenAIPlugin } from "@shiro-sdk/openai";

const studio = await connectStudio({ agentName: "Assistant" });
const events = new TraceManager({ events: studio });

const engine = new Engine({ events });

engine.use(
  new OpenAIPlugin({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "gpt-5",
  })
);

const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful AI assistant.",
  provider: "openai",
});

studio.bind(async (prompt) => engine.execute(agent, prompt));
studio.setAgentName(agent.name);

// Keep the process alive so Studio can send prompts (Live Mode).
console.log("Agent ready. Open Studio with: pnpm exec shiro dev");
console.log(`Studio URL: ${process.env.SHIRO_STUDIO_URL ?? "ws://127.0.0.1:4317"}`);

if (process.argv.includes("--once")) {
  const result = await engine.execute(agent, "Hello!");
  console.log(result.output);
  process.exit(0);
}

await new Promise<never>(() => {
  // Intentional: wait for Studio execute requests until the process is stopped.
});
