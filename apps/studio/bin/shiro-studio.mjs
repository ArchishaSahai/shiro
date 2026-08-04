#!/usr/bin/env node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");

const args = process.argv.slice(2);
let mode = "dev";
let port = process.env.PORT ?? "3001";
let openBrowser = process.env.SHIRO_STUDIO_OPEN !== "0";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "start" || arg === "dev") {
    mode = arg;
  }
  if ((arg === "-p" || arg === "--port") && args[index + 1] !== undefined) {
    port = args[index + 1];
  }
  if (arg === "--no-open") {
    openBrowser = false;
  }
}

const runtimePort = process.env.SHIRO_STUDIO_RUNTIME_PORT ?? String(Number(port) + 1316);
const runtimeUrl = process.env.SHIRO_STUDIO_URL ?? `ws://127.0.0.1:${runtimePort}`;

const require = createRequire(import.meta.url);
let nextBin;

try {
  nextBin = require.resolve("next/dist/bin/next", { paths: [studioRoot] });
} catch {
  const fallback = join(studioRoot, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(fallback)) {
    console.error("Unable to resolve the Next.js CLI for @shiro-sdk/studio.");
    console.error(
      "Reinstall the CLI (Studio is a transitive dependency): pnpm add -D @shiro-sdk/cli"
    );
    process.exit(1);
  }
  nextBin = fallback;
}

const hubPath = join(studioRoot, "server", "runtime-hub.mjs");
const children = [];

if (existsSync(hubPath)) {
  const hub = spawn(process.execPath, [hubPath], {
    cwd: studioRoot,
    env: {
      ...process.env,
      SHIRO_STUDIO_RUNTIME_PORT: runtimePort,
    },
    stdio: "inherit",
  });
  children.push(hub);
  console.log(`[shiro-studio] runtime hub ${runtimeUrl}`);
}

const child = spawn(process.execPath, [nextBin, mode, "-p", String(port)], {
  cwd: studioRoot,
  env: {
    ...process.env,
    NEXT_PUBLIC_SHIRO_STUDIO_URL: runtimeUrl,
    PORT: String(port),
    SHIRO_STUDIO_RUNTIME_PORT: runtimePort,
    SHIRO_STUDIO_URL: runtimeUrl,
  },
  stdio: "inherit",
});
children.push(child);

if (openBrowser && mode === "dev") {
  const url = `http://localhost:${String(port)}`;
  setTimeout(() => {
    openUrl(url);
  }, 2500);
}

function shutdown(code) {
  for (const entry of children) {
    if (!entry.killed) {
      entry.kill("SIGTERM");
    }
  }
  process.exit(code ?? 0);
}

child.on("exit", (code) => {
  shutdown(code ?? 1);
});

process.on("SIGINT", () => {
  shutdown(0);
});
process.on("SIGTERM", () => {
  shutdown(0);
});

function openUrl(url) {
  const command = platform() === "win32" ? "cmd" : platform() === "darwin" ? "open" : "xdg-open";
  const commandArgs = platform() === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, commandArgs, { detached: true, stdio: "ignore" }).unref();
}
