import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * postpack runs BEFORE pnpm/npm finish composing registry metadata on publish.
 * Only clean leftover nest dirs here — never restore package.json (that would
 * re-introduce workspace: into the published packument).
 */
function main() {
  const nestedPackageDir = join(process.cwd(), "package");
  if (existsSync(nestedPackageDir)) {
    rmSync(nestedPackageDir, { recursive: true, force: true });
    console.log("[postpack] Removed leftover package/ directory.");
  }
}

main();
