# @shiro-sdk/cli

Command-line tooling for Shiro. Scaffolds projects, runs diagnostics, and launches Studio.

The npm package name is **`@shiro-sdk/cli`**. The unscoped package `shiro` on npm is unrelated. The binary installed by this package is still named `shiro`.

## Install

```bash
pnpm add -D @shiro-sdk/cli
```

Or run without a permanent install:

```bash
pnpm dlx @shiro-sdk/cli init my-agent
```

## Minimal usage

```bash
pnpm dlx @shiro-sdk/cli init my-agent
# prompts for provider credentials and writes .env
cd my-agent
pnpm dev               # run the agent
pnpm exec shiro dev    # open Studio (ships with the CLI)
```

`shiro init` writes `.env` for you (provider API key + `SHIRO_STUDIO_URL`). Existing shell
environment variables are detected automatically. Use `shiro auth` to update credentials later.
If you skip the key, `shiro dev` will ask again before launching Studio.

Common commands: `shiro init`, `shiro auth`, `shiro dev`, `shiro doctor`, `shiro info`, `shiro providers`, `shiro plugins`.

## Documentation

The [documentation website](https://shiro-docs.vercel.app/docs) is the source of truth.

- [CLI](https://shiro-docs.vercel.app/docs/cli)
- [Installation](https://shiro-docs.vercel.app/docs/installation)
- [Studio](https://shiro-docs.vercel.app/docs/studio)

## Links

- [Documentation](https://shiro-docs.vercel.app/docs)
- [GitHub repository](https://github.com/ArchishaSahai/shiro)
- [Report issues](https://github.com/ArchishaSahai/shiro/issues)

## License

MIT
