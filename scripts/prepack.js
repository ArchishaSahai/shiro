import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

// Cache for package versions
const versionCache = new Map();

function getPackageVersion(packageName) {
  if (versionCache.has(packageName)) {
    return versionCache.get(packageName);
  }

  // Map package name to its directory path in the monorepo
  const nameMap = {
    "@shiro-sdk/core": "packages/core",
    "@shiro-sdk/openai": "packages/openai",
    "@shiro-sdk/shared": "packages/shared",
    "@shiro-sdk/cli": "packages/cli",
  };

  const relPath = nameMap[packageName];
  if (!relPath) {
    return null;
  }

  const pkgJsonPath = join(workspaceRoot, relPath, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  versionCache.set(packageName, pkg.version);
  return pkg.version;
}

function main() {
  const localPkgJsonPath = resolve(process.cwd(), "package.json");
  const localPkgJsonBakPath = resolve(process.cwd(), "package.json.bak");

  if (!existsSync(localPkgJsonPath)) {
    console.error("No package.json found in current working directory.");
    process.exit(1);
  }

  const pkgContent = readFileSync(localPkgJsonPath, "utf8");
  // Save backup
  writeFileSync(localPkgJsonBakPath, pkgContent, "utf8");

  const pkg = JSON.parse(pkgContent);
  let changed = false;

  for (const depType of ["dependencies", "peerDependencies"]) {
    if (!pkg[depType]) continue;

    for (const [name, versionSpec] of Object.entries(pkg[depType])) {
      if (typeof versionSpec === "string" && versionSpec.startsWith("workspace:")) {
        const resolvedVersion = getPackageVersion(name);
        if (resolvedVersion) {
          // If workspaceSpec has a range character like ^, preserve it, otherwise default to ^
          const prefix = versionSpec.includes("^") ? "^" : "";
          pkg[depType][name] = `${prefix}${resolvedVersion}`;
          changed = true;
          console.log(
            `[prepack] Rewrote ${name} dependency from "${versionSpec}" to "${pkg[depType][name]}"`
          );
        } else {
          console.warn(
            `[prepack] Warning: Could not resolve workspace package version for ${name}`
          );
        }
      }
    }
  }

  if (changed) {
    writeFileSync(localPkgJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }
}

main();
