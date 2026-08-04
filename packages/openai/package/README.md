# @shiro-sdk/openai

OpenAI provider plugin for Shiro. Registers the OpenAI backend with the engine so agents can set `provider: "openai"`.

## Install

```bash
pnpm add @shiro-sdk/core @shiro-sdk/openai
```

Set `OPENAI_API_KEY` in your environment.

## Minimal example

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
  name: "assistant",
  instructions: "Be concise.",
  provider: "openai",
});

const result = await engine.execute(agent, "Hello!");
console.log(result.output);
```

## Documentation

The [documentation website](https://shiro-docs.vercel.app/docs) is the source of truth.

- [Providers](https://shiro-docs.vercel.app/docs/providers)
- [Plugins](https://shiro-docs.vercel.app/docs/plugins)
- [Quick start](https://shiro-docs.vercel.app/docs/quick-start)

## Links

- [Documentation](https://shiro-docs.vercel.app/docs)
- [GitHub repository](https://github.com/ArchishaSahai/shiro)
- [Report issues](https://github.com/ArchishaSahai/shiro/issues)

## License

MIT
