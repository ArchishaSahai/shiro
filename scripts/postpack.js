import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function main() {
  const localPkgJsonPath = resolve(process.cwd(), "package.json");
  const localPkgJsonBakPath = resolve(process.cwd(), "package.json.bak");

  if (existsSync(localPkgJsonBakPath)) {
    const originalContent = readFileSync(localPkgJsonBakPath, "utf8");
    writeFileSync(localPkgJsonPath, originalContent, "utf8");
    unlinkSync(localPkgJsonBakPath);
    console.log("[postpack] Restored original package.json and removed backup.");
  }
}

main();
