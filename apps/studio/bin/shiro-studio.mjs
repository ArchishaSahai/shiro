#!/usr/bin/env node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");

const args = process.argv.slice(2);
let mode = "dev";
let port = process.env.PORT ?? "3001";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "start" || arg === "dev") {
    mode = arg;
  }
  if ((arg === "-p" || arg === "--port") && args[index + 1] !== undefined) {
    port = args[index + 1];
  }
}

const require = createRequire(import.meta.url);
let nextBin;

try {
  nextBin = require.resolve("next/dist/bin/next", { paths: [studioRoot] });
} catch {
  const fallback = join(studioRoot, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(fallback)) {
    console.error("Unable to resolve the Next.js CLI for @shiro/studio.");
    console.error("Reinstall dependencies with: pnpm add -D @shiro/studio");
    process.exit(1);
  }
  nextBin = fallback;
}

const child = spawn(process.execPath, [nextBin, mode, "-p", String(port)], {
  cwd: studioRoot,
  env: {
    ...process.env,
    PORT: String(port),
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
