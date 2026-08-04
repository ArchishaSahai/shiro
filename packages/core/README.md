# @shiro-sdk/core

Core TypeScript runtime for Shiro agents: `Engine`, `Agent`, tools, handoffs, memory, sessions, approvals, tracing, and plugins.

## Install

```bash
pnpm add @shiro-sdk/core
```

You typically also install a provider plugin such as [`@shiro-sdk/openai`](https://www.npmjs.com/package/@shiro-sdk/openai).

## Minimal example

```ts
import { Agent, Engine } from "@shiro-sdk/core";

const engine = new Engine();
// engine.use(new OpenAIPlugin({ ... })) from @shiro-sdk/openai

const agent = new Agent({
  name: "assistant",
  instructions: "Be concise.",
  provider: "openai",
});

const result = await engine.execute(agent, "Hello!");
console.log(result.output);
```

## Documentation

The [documentation website](https://shiro-docs.vercel.app/docs) is the source of truth.

- [Quick start](https://shiro-docs.vercel.app/docs/quick-start)
- [Installation](https://shiro-docs.vercel.app/docs/installation)
- [API reference](https://shiro-docs.vercel.app/docs/api-reference)

## Links

- [Documentation](https://shiro-docs.vercel.app/docs)
- [GitHub repository](https://github.com/ArchishaSahai/shiro)
- [Report issues](https://github.com/ArchishaSahai/shiro/issues)

## License

MIT
