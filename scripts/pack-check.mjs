import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXPECTED_VERSION = "0.1.7";

const packages = [
  "packages/shared",
  "packages/core",
  "packages/openai",
  "packages/cli",
  "apps/studio",
];

let failed = false;

function removeTarballs(dir) {
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".tgz")) {
      unlinkSync(join(dir, name));
    }
  }
}

for (const dir of packages) {
  const absDir = join(process.cwd(), dir);
  removeTarballs(absDir);

  const result = spawnSync("pnpm", ["pack"], {
    cwd: absDir,
    encoding: "utf8",
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`pack failed for ${dir}`);
    console.error(result.stdout);
    console.error(result.stderr);
    failed = true;
    continue;
  }

  const tgzFiles = readdirSync(absDir)
    .filter((name) => name.endsWith(".tgz"))
    .sort((a, b) => statSync(join(absDir, b)).mtimeMs - statSync(join(absDir, a)).mtimeMs);

  const file = tgzFiles[0];
  if (file === undefined) {
    console.error(`no tgz produced in ${dir}`);
    failed = true;
    continue;
  }

  const tgzPath = join(absDir, file);
  const inspect = mkdtempSync(join(tmpdir(), "shiro-pack-"));
  const extract = spawnSync("tar", ["-xf", tgzPath, "-C", inspect], {
    encoding: "utf8",
    shell: true,
  });
  if (extract.status !== 0) {
    console.error(`failed to extract ${tgzPath}`);
    failed = true;
    continue;
  }

  const pkgRoot = join(inspect, "package");
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
  const blob = JSON.stringify(pkg);
  const hasWorkspace = blob.includes("workspace:");
  const hasReadme = existsSync(join(pkgRoot, "README.md"));
  const hasLicense = existsSync(join(pkgRoot, "LICENSE"));
  const versionOk = pkg.version === EXPECTED_VERSION;

  if (hasWorkspace || !versionOk || !hasReadme || !hasLicense) {
    console.error(
      `FAIL ${dir}: version=${pkg.version} workspace=${String(hasWorkspace)} readme=${String(hasReadme)} license=${String(hasLicense)} tarball=${file}`
    );
    failed = true;
  } else {
    console.log(`OK   ${pkg.name}@${pkg.version} (${file})`);
    const deps = { ...(pkg.dependencies ?? {}) };
    for (const [name, spec] of Object.entries(deps)) {
      if (name.startsWith("@shiro-sdk/")) {
        console.log(`       ${name}: ${spec}`);
      }
    }
  }

  rmSync(inspect, { recursive: true, force: true });
  removeTarballs(absDir);
  if (existsSync(join(absDir, "package"))) {
    rmSync(join(absDir, "package"), { recursive: true, force: true });
  }
  // prepack leaves rewritten package.json; restore workspace: for the monorepo.
  spawnSync("node", [join(process.cwd(), "scripts", "restore-package-json.js")], {
    cwd: absDir,
    encoding: "utf8",
    shell: true,
  });
}

if (!failed) {
  console.log("\nAll tarballs clean. Workspace package.json files restored.");
}

process.exit(failed ? 1 : 0);
