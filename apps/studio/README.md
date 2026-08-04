# Shiro Studio

Local runtime debugger for Shiro agents.

## Usage

```bash
pnpm exec shiro dev
```

Starts:

1. Studio UI (default `http://localhost:3001`)
2. Runtime WebSocket hub (default `ws://127.0.0.1:4317`)
3. Browser (unless `--no-open`)

Connect an agent with `SHIRO_STUDIO_URL` (see `@shiro-sdk/core` `connectStudio`).

When no agent is connected, Studio automatically uses **Demo Mode**.

## License

MIT
