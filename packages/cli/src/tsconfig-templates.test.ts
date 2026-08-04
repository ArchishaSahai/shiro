import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  agentTsconfigTemplate,
  isSelfContainedTsconfig,
  standaloneStudioTsconfig,
  writeStandaloneStudioTsconfig,
} from "./tsconfig-templates.js";

describe("generated tsconfig is self-contained", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("agent tsconfig does not extend tsconfig.base.json", () => {
    const raw = agentTsconfigTemplate();
    expect(isSelfContainedTsconfig(raw)).toBe(true);
    expect(raw).not.toContain("extends");
    expect(raw).not.toContain("tsconfig.base.json");
  });

  it("standalone Studio tsconfig does not extend monorepo base", () => {
    const raw = `${JSON.stringify(standaloneStudioTsconfig(), null, 2)}\n`;
    expect(isSelfContainedTsconfig(raw)).toBe(true);
    expect(raw).not.toContain("extends");
    expect(raw).not.toContain("tsconfig.base.json");
  });

  it("writeStandaloneStudioTsconfig writes a self-contained file", () => {
    const dir = mkdtempSync(join(tmpdir(), "shiro-studio-tsconfig-"));
    dirs.push(dir);
    const filePath = join(dir, "tsconfig.json");
    writeStandaloneStudioTsconfig(filePath);
    const raw = readFileSync(filePath, "utf8");
    expect(isSelfContainedTsconfig(raw)).toBe(true);
  });

  it("scaffolds a temp project whose tsconfig is self-contained", () => {
    const dir = mkdtempSync(join(tmpdir(), "shiro-init-tsconfig-"));
    dirs.push(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "tsconfig.json"), agentTsconfigTemplate(), "utf8");
    writeStandaloneStudioTsconfig(join(dir, "studio-tsconfig.json"));

    const agentRaw = readFileSync(join(dir, "tsconfig.json"), "utf8");
    const studioRaw = readFileSync(join(dir, "studio-tsconfig.json"), "utf8");

    expect(isSelfContainedTsconfig(agentRaw)).toBe(true);
    expect(isSelfContainedTsconfig(studioRaw)).toBe(true);

    // Simulate the historical bug: monorepo extends must never appear in scaffolds.
    expect(agentRaw).not.toMatch(/tsconfig\.base\.json/);
    expect(studioRaw).not.toMatch(/tsconfig\.base\.json/);
  });

  it("rewrites a Studio launch copy that still has monorepo extends", () => {
    const dir = mkdtempSync(join(tmpdir(), "shiro-studio-launch-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "tsconfig.json"),
      `${JSON.stringify(
        {
          extends: "../../tsconfig.base.json",
          compilerOptions: { strict: true },
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    writeStandaloneStudioTsconfig(join(dir, "tsconfig.json"));
    const raw = readFileSync(join(dir, "tsconfig.json"), "utf8");
    expect(isSelfContainedTsconfig(raw)).toBe(true);
    expect(raw).not.toContain("tsconfig.base.json");
  });
});
