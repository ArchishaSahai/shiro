# @shiro/cli

Command-line interface for Shiro. The npm package is **`@shiro/cli`** (the bare name `shiro` on npm is unrelated). The binary installed by this package is still named `shiro`.

## Install

```bash
pnpm add -D @shiro/cli @shiro/studio
# or
pnpm dlx @shiro/cli init my-agent
```

## Commands

```bash
shiro init my-agent
shiro dev
shiro doctor
shiro info
shiro providers
shiro plugins
shiro version
```

## Quick Start

```bash
pnpm dlx @shiro/cli init my-agent
cd my-agent
cp .env.example .env
pnpm dev
pnpm studio
```

`shiro init` prompts for package manager, provider, model, and TypeScript or JavaScript. It scaffolds a runnable agent project and installs dependencies by default.

For non-interactive environments:

```bash
pnpm dlx @shiro/cli init my-agent --yes --no-install
```

## Studio

`shiro dev` launches `@shiro/studio` from:

1. `./node_modules/@shiro/studio` in the current project
2. the monorepo `apps/studio` package when developing inside this repository

Install Studio in consumer projects with `pnpm add -D @shiro/studio` (also added by `shiro init`).
