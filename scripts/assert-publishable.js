import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guard for npm/pnpm publish — published manifests must never contain workspace:.
 */
function main() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  if (!existsSync(packageJsonPath)) {
    console.error("[assert-publish] package.json not found");
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const offenders = [];

  for (const depType of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    const deps = pkg[depType];
    if (deps === undefined) {
      continue;
    }
    for (const [name, versionSpec] of Object.entries(deps)) {
      if (typeof versionSpec === "string" && versionSpec.includes("workspace:")) {
        offenders.push(`${depType}.${name}: ${versionSpec}`);
      }
    }
  }

  if (offenders.length > 0) {
    console.error(
      "[assert-publish] Refusing to publish: workspace: protocol must be rewritten first."
    );
    for (const entry of offenders) {
      console.error(`  - ${entry}`);
    }
    console.error("Run the package prepack script, or publish with: pnpm publish");
    process.exit(1);
  }
}

main();
