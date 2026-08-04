import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findShiroWorkspaceRootFrom,
  findWorkspaceRootOptional,
  isShiroWorkspaceRoot,
  resolveMonorepoVendorRoot,
} from "./workspace.js";

/** Monorepo root — vitest cwd is packages/cli. */
const repoRoot = resolve(process.cwd(), "..", "..");

describe("isShiroWorkspaceRoot", () => {
  it("recognizes this monorepo", () => {
    expect(isShiroWorkspaceRoot(repoRoot)).toBe(true);
  });

  it("rejects a plain directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "shiro-ws-"));
    try {
      expect(isShiroWorkspaceRoot(dir)).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("rejects a pnpm workspace that is not Shiro", () => {
    const dir = mkdtempSync(join(tmpdir(), "shiro-ws-"));
    try {
      writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      expect(isShiroWorkspaceRoot(dir)).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

describe("resolveMonorepoVendorRoot (target-based)", () => {
  it("returns null for a project outside the monorepo", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "shiro-outside-"));
    try {
      const target = join(outsideDir, "my-agent");
      mkdirSync(target, { recursive: true });
      expect(resolveMonorepoVendorRoot(target)).toBeNull();
      expect(findShiroWorkspaceRootFrom(target)).toBeNull();
    } finally {
      rmSync(outsideDir, { force: true, recursive: true });
    }
  });

  it("returns the workspace root for a project inside the monorepo", () => {
    const target = join(repoRoot, "tmp-agent-inside-test");
    mkdirSync(target, { recursive: true });
    try {
      expect(resolveMonorepoVendorRoot(target)).toBe(repoRoot);
    } finally {
      rmSync(target, { force: true, recursive: true });
    }
  });
});

describe("findWorkspaceRootOptional (CLI tooling)", () => {
  it("finds the monorepo via CLI module URL even when cwd is outside", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "shiro-cwd-"));
    try {
      const cliModuleUrl = pathToFileURL(
        join(repoRoot, "packages", "cli", "dist", "index.js")
      ).href;
      const found = findWorkspaceRootOptional({
        cliModuleUrl,
        cwd: outsideDir,
      });
      expect(found).toBe(repoRoot);
    } finally {
      rmSync(outsideDir, { force: true, recursive: true });
    }
  });

  it("does not treat CLI-module detection as a reason to vendor outside targets", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "shiro-cwd-"));
    try {
      const target = join(outsideDir, "my-agent");
      mkdirSync(target, { recursive: true });

      // Simulates: local CLI binary lives in the monorepo, project is outside.
      const cliModuleUrl = pathToFileURL(
        join(repoRoot, "packages", "cli", "dist", "index.js")
      ).href;
      expect(findWorkspaceRootOptional({ cliModuleUrl, cwd: outsideDir })).toBe(repoRoot);
      // Install specs must still use the target path — not the CLI location.
      expect(resolveMonorepoVendorRoot(target)).toBeNull();
    } finally {
      rmSync(outsideDir, { force: true, recursive: true });
    }
  });
});

describe("install spec selection", () => {
  const VERSION = "0.1.8";

  function chooseSpecs(targetDir: string): Record<string, string> {
    const vendorRoot = resolveMonorepoVendorRoot(targetDir);
    if (vendorRoot === null) {
      return {
        cli: `^${VERSION}`,
        core: `^${VERSION}`,
        openai: `^${VERSION}`,
      };
    }
    return {
      cli: "file:.shiro-packages/shiro-cli",
      core: "file:.shiro-packages/shiro-core",
      openai: "file:.shiro-packages/shiro-openai",
    };
  }

  it("outside workspace → npm semver (local CLI case)", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "shiro-specs-out-"));
    try {
      const target = join(outsideDir, "my-agent");
      mkdirSync(target, { recursive: true });
      expect(chooseSpecs(target)).toEqual({
        cli: "^0.1.8",
        core: "^0.1.8",
        openai: "^0.1.8",
      });
    } finally {
      rmSync(outsideDir, { force: true, recursive: true });
    }
  });

  it("inside workspace → file: vendor specs", () => {
    const target = join(repoRoot, "tmp-specs-inside-test");
    mkdirSync(target, { recursive: true });
    try {
      expect(chooseSpecs(target)).toEqual({
        cli: "file:.shiro-packages/shiro-cli",
        core: "file:.shiro-packages/shiro-core",
        openai: "file:.shiro-packages/shiro-openai",
      });
    } finally {
      rmSync(target, { force: true, recursive: true });
    }
  });

  it("published CLI outside workspace → npm semver", () => {
    const outsideDir = mkdtempSync(join(tmpdir(), "shiro-published-"));
    try {
      const target = join(outsideDir, "app");
      mkdirSync(target, { recursive: true });
      expect(chooseSpecs(target).core).toMatch(/^\^/);
    } finally {
      rmSync(outsideDir, { force: true, recursive: true });
    }
  });
});
