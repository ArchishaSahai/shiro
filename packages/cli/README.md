# shiro

Command-line interface for Shiro.

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
shiro init my-agent
cd my-agent
cp .env.example .env
pnpm dev
```

`shiro init` prompts for package manager, provider, model, and TypeScript or JavaScript. It scaffolds a runnable agent project and installs dependencies by default.

For non-interactive environments:

```bash
shiro init my-agent --yes --no-install
```
