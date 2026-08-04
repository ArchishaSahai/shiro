import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { isSelfContainedTsconfig } from "./tsconfig-templates.js";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(cliRoot, "dist", "index.js");
const monorepoRoot = resolve(cliRoot, "..", "..");

describe("shiro init tsconfig regression", () => {
  const dirs: string[] = [];

  beforeAll(() => {
    const build = spawnSync("pnpm", ["run", "build"], {
      cwd: cliRoot,
      encoding: "utf8",
      shell: true,
    });
    expect(build.status, build.stderr || build.stdout).toBe(0);
    expect(existsSync(cliEntry)).toBe(true);
  }, 60_000);

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("scaffolds a self-contained tsconfig outside the monorepo", () => {
    const parent = mkdtempSync(join(tmpdir(), "shiro-outside-init-"));
    dirs.push(parent);

    const result = spawnSync(
      process.execPath,
      [cliEntry, "init", "qa-agent", "--yes", "--no-install"],
      {
        cwd: parent,
        encoding: "utf8",
        env: {
          ...process.env,
          CI: "1",
        },
        shell: false,
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const projectDir = join(parent, "qa-agent");
    const tsconfigPath = join(projectDir, "tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);

    const raw = readFileSync(tsconfigPath, "utf8");
    expect(isSelfContainedTsconfig(raw)).toBe(true);
    expect(raw).not.toContain("tsconfig.base.json");
    expect(raw).not.toContain('"extends"');

    // Outside monorepo must not vendor packages (npm semver ranges only).
    expect(existsSync(join(projectDir, ".shiro-packages"))).toBe(false);

    expect(raw.includes(monorepoRoot.replace(/\\/g, "/"))).toBe(false);
  });
});
