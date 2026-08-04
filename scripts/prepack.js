import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

const PACKAGE_DIRS = {
  "@shiro-sdk/cli": "packages/cli",
  "@shiro-sdk/core": "packages/core",
  "@shiro-sdk/openai": "packages/openai",
  "@shiro-sdk/shared": "packages/shared",
  "@shiro-sdk/studio": "apps/studio",
};

const versionCache = new Map();

function getPackageVersion(packageName) {
  if (versionCache.has(packageName)) {
    return versionCache.get(packageName);
  }

  const relPath = PACKAGE_DIRS[packageName];
  if (relPath === undefined) {
    return null;
  }

  const pkgJsonPath = join(workspaceRoot, relPath, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  if (typeof pkg.version !== "string" || pkg.version.length === 0) {
    return null;
  }

  versionCache.set(packageName, pkg.version);
  return pkg.version;
}

function rewriteWorkspaceSpec(versionSpec, resolvedVersion) {
  if (versionSpec === "workspace:*" || versionSpec === "workspace:^") {
    return `^${resolvedVersion}`;
  }
  if (versionSpec.startsWith("workspace:~")) {
    return `~${resolvedVersion}`;
  }
  if (versionSpec.startsWith("workspace:^")) {
    return `^${resolvedVersion}`;
  }
  if (versionSpec.startsWith("workspace:")) {
    return resolvedVersion;
  }
  return versionSpec;
}

function main() {
  const cwd = process.cwd();
  const localPkgJsonPath = resolve(cwd, "package.json");
  const localPkgJsonBakPath = resolve(cwd, "package.json.bak");
  const nestedPackageDir = join(cwd, "package");

  if (!existsSync(localPkgJsonPath)) {
    console.error("[prepack] No package.json found in current working directory.");
    process.exit(1);
  }

  // Stale nested package/ dirs from prior packs must not ship.
  if (existsSync(nestedPackageDir)) {
    rmSync(nestedPackageDir, { recursive: true, force: true });
    console.log("[prepack] Removed leftover package/ directory.");
  }

  const pkgContent = readFileSync(localPkgJsonPath, "utf8");
  const pkg = JSON.parse(pkgContent);
  const stillHasWorkspace = /"workspace:/.test(pkgContent);

  // Backup once per publish/pack cycle. Refresh a leftover bak when package.json still
  // has workspace: (stale bak from an interrupted pack would otherwise undo version bumps
  // on restore). Keep the existing bak when package.json is already rewritten (second
  // prepack from prepublishOnly + pack).
  if (!existsSync(localPkgJsonBakPath) || stillHasWorkspace) {
    writeFileSync(localPkgJsonBakPath, pkgContent, "utf8");
  }
  let changed = false;
  const unresolved = [];

  for (const depType of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    if (pkg[depType] === undefined) {
      continue;
    }

    for (const [name, versionSpec] of Object.entries(pkg[depType])) {
      if (typeof versionSpec !== "string" || !versionSpec.startsWith("workspace:")) {
        continue;
      }

      const resolvedVersion = getPackageVersion(name);
      if (resolvedVersion === null) {
        unresolved.push(`${depType}.${name}=${versionSpec}`);
        continue;
      }

      const nextSpec = rewriteWorkspaceSpec(versionSpec, resolvedVersion);
      pkg[depType][name] = nextSpec;
      changed = true;
      console.log(`[prepack] Rewrote ${name}: "${versionSpec}" → "${nextSpec}"`);
    }
  }

  if (unresolved.length > 0) {
    console.error("[prepack] Failed to rewrite workspace dependencies:");
    for (const entry of unresolved) {
      console.error(`  - ${entry}`);
    }
    process.exit(1);
  }

  const serialized = `${JSON.stringify(pkg, null, 2)}\n`;
  if (/"workspace:/.test(serialized)) {
    console.error(
      "[prepack] Refusing to continue: package.json still contains workspace: protocol."
    );
    process.exit(1);
  }

  if (changed) {
    writeFileSync(localPkgJsonPath, serialized, "utf8");
  }
}

main();
