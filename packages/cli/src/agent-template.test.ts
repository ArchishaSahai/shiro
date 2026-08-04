import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The scaffolded agent must not use an unresolved top-level await.
 * Node treats that as a hang and exits with code 13 + a warning.
 */
describe("agent template keep-alive", () => {
  it("keeps the process alive with a timer and exits cleanly on signals", () => {
    const source = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
    const start = source.indexOf("function agentTemplate(");
    const end = source.indexOf("function readmeTemplate(");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const template = source.slice(start, end);

    expect(template).not.toContain("Promise<never>");
    expect(template).toContain("setInterval");
    expect(template).toContain("clearInterval(keepAlive)");
    expect(template).toContain('process.once("SIGINT"');
    expect(template).toContain('process.once("SIGTERM"');
    expect(template).toContain("process.exit(0)");
    expect(template).toContain("studio.close()");
  });
});
