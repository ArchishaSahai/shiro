<p align="center">
  <img alt="Shiro" src="https://placehold.co/160x160/111111/ffffff?text=Shiro" width="96" height="96" />
</p>

<h1 align="center">Shiro</h1>

<p align="center">
  <strong>A TypeScript runtime for agents you can inspect.</strong>
</p>

<p align="center">
  Orchestrate provider calls, tools, handoffs, approvals, memory, and traces in one execution model — with Studio for debugging runs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shiro-sdk/core"><img alt="npm" src="https://img.shields.io/npm/v/@shiro-sdk/core?color=111111&label=@shiro-sdk/core"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111111.svg"></a>
  <a href="https://github.com/ArchishaSahai/shiro/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/ArchishaSahai/shiro/ci.yml?branch=main&label=ci"></a>
</p>

---

## Why Shiro?

Provider SDKs talk to models. Production agents also need an execution loop, tools, retries, sessions, memory, handoffs, human approval, structured outputs, and traces.

Shiro owns that orchestration layer so your app can focus on instructions, tools, and product behavior.

## Quick start

```bash
pnpm add @shiro-sdk/core @shiro-sdk/openai zod
```

```ts
import { Agent, Engine } from "@shiro-sdk/core";
import { OpenAIPlugin } from "@shiro-sdk/openai";

const engine = new Engine();

engine.use(
  new OpenAIPlugin({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-5",
  })
);

const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful AI assistant.",
  provider: "openai",
});

const result = await engine.execute(agent, "Hello!");
console.log(result.output);
```

Scaffold a project (package name is **`@shiro-sdk/cli`**, not the unrelated npm package `shiro`):

```bash
pnpm dlx @shiro-sdk/cli init my-agent
```

## Packages

| Package                                  | Role                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`@shiro-sdk/core`](./packages/core)     | Engine, agents, tools, memory, sessions, tracing, approvals |
| [`@shiro-sdk/openai`](./packages/openai) | OpenAI provider plugin                                      |
| [`@shiro-sdk/cli`](./packages/cli)       | `shiro` CLI — init, doctor, Studio launch                   |
| [`@shiro-sdk/studio`](./apps/studio)     | Studio UI (launched by CLI; not an app dependency)          |

## Documentation

**[shiro-docs.vercel.app](https://shiro-docs.vercel.app/docs)** is the source of truth for guides, architecture, API reference, Studio, and CLI.

Start here:

- [Installation](https://shiro-docs.vercel.app/docs/installation)
- [Quick start](https://shiro-docs.vercel.app/docs/quick-start)
- [Studio](https://shiro-docs.vercel.app/docs/studio)
- [CLI](https://shiro-docs.vercel.app/docs/cli)
- [API reference](https://shiro-docs.vercel.app/docs/api-reference)

## Contributing

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm format:check
```

## License

MIT © Shiro contributors
