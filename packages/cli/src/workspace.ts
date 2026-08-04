import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when `dir` is the Shiro monorepo root (not an arbitrary pnpm workspace).
 */
export function isShiroWorkspaceRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "pnpm-workspace.yaml")) &&
    existsSync(join(dir, "packages", "core", "package.json")) &&
    existsSync(join(dir, "packages", "cli", "package.json")) &&
    existsSync(join(dir, "apps", "studio", "package.json"))
  );
}

/**
 * Walk upward from `startPath` looking for the Shiro monorepo root.
 * Does not consult the CLI install location — use this for target-project decisions.
 */
export function findShiroWorkspaceRootFrom(startPath: string): string | null {
  let current = resolve(startPath);
  for (;;) {
    if (isShiroWorkspaceRoot(current)) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

/**
 * Locate the Shiro workspace for CLI tooling (Studio resolution, local builds).
 * Searches process.cwd() first, then the directory of this CLI module.
 *
 * WARNING: A hit via the CLI module path means the CLI was built from the monorepo —
 * it must NOT be used to decide whether a consumer project gets `file:` dependencies.
 */
export function findWorkspaceRootOptional(
  options: {
    readonly cwd?: string;
    readonly cliModuleUrl?: string;
  } = {}
): string | null {
  const cwd = options.cwd ?? process.cwd();
  const cliModuleUrl = options.cliModuleUrl ?? import.meta.url;
  const starts = [cwd, dirname(fileURLToPath(cliModuleUrl))];

  for (const start of starts) {
    const found = findShiroWorkspaceRootFrom(start);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

/**
 * Whether scaffolding `targetDir` should vendor monorepo packages as `file:` deps.
 * Only when the target project itself lives inside the Shiro workspace.
 */
export function resolveMonorepoVendorRoot(targetDir: string): string | null {
  return findShiroWorkspaceRootFrom(targetDir);
}
