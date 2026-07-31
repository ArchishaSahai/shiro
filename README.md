# Shiro

[![CI](https://img.shields.io/github/actions/workflow/status/shiro-sdk/shiro/ci.yml?branch=main&label=ci)](https://github.com/shiro-sdk/shiro/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Package Manager](https://img.shields.io/badge/package%20manager-pnpm-f69220.svg)](https://pnpm.io/)

Production-ready TypeScript Agent SDK.

Shiro is an open-source framework for building AI agents in TypeScript. It is designed to own the orchestration layer around agents so application developers can focus on instructions, tools, and domain behavior.

## Features

Planned capabilities include:

- Agent execution loop orchestration
- Provider abstraction
- Message history and session management
- Middleware
- Guardrails
- Human approval workflows
- Agent handoffs
- Tracing and observability
- First-class CLI and local development tooling

## Architecture

Shiro is organized as a pnpm and TurboRepo monorepo:

- `packages/core` will contain the framework primitives and public SDK surface.
- `packages/shared` contains cross-package utilities and types that are not tied to runtime behavior.
- `packages/cli` provides the future `shiro` executable.
- `apps/docs` is reserved for the documentation site.
- `apps/studio` is reserved for the local Studio experience.
- `examples/basic-agent` will become the first minimal integration example.

Phase 1 intentionally avoids runtime implementation. The repository currently establishes package boundaries, build tooling, type safety, CI, release workflow primitives, and contribution workflow.

## Roadmap

- Phase 1: Repository foundation and architecture
- Phase 2: Core agent runtime and execution model
- Phase 3: Provider integrations
- Phase 4: Tools, middleware, guardrails, and approvals
- Phase 5: Sessions, persistence, handoffs, and tracing
- Phase 6: CLI, Studio, documentation, and production examples

## Installation

Coming soon.

## Contributing

Shiro is early-stage and being developed in public. Contributions should keep the framework small, explicit, and easy to reason about.

Before opening a pull request, run:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## License

MIT
