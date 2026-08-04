import { readFileSync, writeFileSync, unlinkSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Restore workspace: package.json after a successful publish (postpublish),
 * or after a local pack check. Must NOT run as postpack during publish.
 */
function main() {
  const cwd = process.cwd();
  const localPkgJsonPath = resolve(cwd, "package.json");
  const localPkgJsonBakPath = resolve(cwd, "package.json.bak");
  const nestedPackageDir = join(cwd, "package");

  if (existsSync(nestedPackageDir)) {
    rmSync(nestedPackageDir, { recursive: true, force: true });
    console.log("[restore-package-json] Removed leftover package/ directory.");
  }

  if (existsSync(localPkgJsonBakPath)) {
    const originalContent = readFileSync(localPkgJsonBakPath, "utf8");
    writeFileSync(localPkgJsonPath, originalContent, "utf8");
    unlinkSync(localPkgJsonBakPath);
    console.log("[restore-package-json] Restored original package.json and removed backup.");
  }
}

main();
