#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import boxen from "boxen";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";

const VERSION = "0.1.0";
const GITHUB_REPO = "ArchishaSahai/shiro";
const REQUIRE = createRequire(import.meta.url);

const PROVIDERS: readonly ProviderSummary[] = [
  {
    configKeys: ["OPENAI_API_KEY"],
    dependency: "@shiro/openai",
    displayName: "OpenAI",
    packageName: "@shiro/openai",
    providerId: "openai",
    packageDir: "packages/openai",
  },
];

type PackageManager = "pnpm" | "npm" | "yarn";
type Language = "typescript" | "javascript";
type ProviderId = "openai";
type CheckStatus = "ok" | "warning" | "error";

interface InitAnswers {
  readonly language: Language;
  readonly model: string;
  readonly packageManager: PackageManager;
  readonly provider: ProviderId;
}

interface ProviderSummary {
  readonly configKeys: readonly string[];
  readonly dependency: string;
  readonly displayName: string;
  readonly packageName: string;
  readonly providerId: ProviderId;
  readonly packageDir: string;
}

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly name?: string;
  readonly version?: string;
}

interface Diagnostic {
  readonly message: string;
  readonly status: CheckStatus;
  readonly suggestion?: string;
}

interface ShiroConfig {
  readonly provider?: string;
  readonly model?: string;
  readonly studio?: {
    readonly port?: number;
  };
}

interface InitCommandOptions {
  readonly install?: boolean;
  readonly language?: Language;
  readonly model?: string;
  readonly packageManager?: PackageManager;
  readonly provider?: ProviderId;
  readonly yes?: boolean;
}

const program = new Command();

program
  .name("shiro")
  .description("Developer tooling for Shiro agent projects. Package: @shiro/cli")
  .version(VERSION, "-v, --version", "Display the Shiro CLI version.");

program
  .command("init")
  .argument("[name]", "Project directory")
  .description("Scaffold a new Shiro agent project.")
  .option("--package-manager <manager>", "Package manager: pnpm, npm, or yarn", parsePackageManager)
  .option("--provider <provider>", "Provider: openai", parseProvider)
  .option("--model <model>", "Model name")
  .option("--language <language>", "Language: typescript or javascript", parseLanguage)
  .option("--no-install", "Skip dependency installation")
  .option("-y, --yes", "Use defaults without prompting")
  .action(async (name: string | undefined, options: InitCommandOptions) => {
    await initCommand(name, options);
  });

program
  .command("dev")
  .description("Validate the current project and launch Shiro Studio.")
  .option("-p, --port <port>", "Studio port", parsePort)
  .action(async (options: { readonly port?: number }) => {
    await devCommand(options.port);
  });

program
  .command("doctor")
  .description("Run project diagnostics.")
  .action(async () => {
    await doctorCommand();
  });

program
  .command("info")
  .description("Display Shiro project information.")
  .action(async () => {
    await infoCommand();
  });

program
  .command("providers")
  .description("List provider integration status.")
  .action(async () => {
    await providersCommand();
  });

program
  .command("plugins")
  .description("List installed Shiro plugins.")
  .action(async () => {
    await pluginsCommand();
  });

program
  .command("version")
  .description("Display the Shiro CLI version.")
  .action(() => {
    console.log(VERSION);
  });

if (isCliEntrypoint()) {
  await program.parseAsync(process.argv);
}

async function initCommand(name: string | undefined, options: InitCommandOptions): Promise<void> {
  const answers = options.yes === true ? defaultsForInit(options) : await promptForInit(options);
  const targetName = name ?? "my-agent";
  const targetDir = resolve(process.cwd(), targetName);

  if (existsSync(targetDir)) {
    throwUserError(`Directory already exists: ${targetName}`);
  }

  const spinner = ora(`Creating ${targetName}`).start();
  ensureLocalPackagesBuilt();
  const installSpecs = await resolveInstallSpecs(targetDir);
  await writeProject(targetDir, targetName, answers, installSpecs);
  spinner.succeed(`Created ${targetName}`);

  if (options.install === false) {
    printMuted(
      `Skipped dependency installation. Run ${installCommandFor(answers.packageManager)} inside ${targetName}.`
    );
  } else {
    const install = ora(`Installing dependencies with ${answers.packageManager}`).start();
    const result = runInstall(answers.packageManager, targetDir);

    if (result.status === 0) {
      install.succeed("Dependencies installed");
    } else {
      install.warn("Project created, but dependency installation did not complete");
      printMuted(`Run ${installCommandFor(answers.packageManager)} inside ${targetName}.`);
      printMuted(
        "If packages are not on npm yet, init from this monorepo so file: deps resolve, or publish @shiro/* first."
      );
    }
  }

  console.log(
    boxen(
      [
        chalk.bold("Shiro project ready"),
        "",
        `${chalk.dim("Next:")} cd ${targetName}`,
        `${chalk.dim("Env:")} cp .env.example .env`,
        `${chalk.dim("Run:")} ${answers.packageManager === "npm" ? "npm run dev" : `${answers.packageManager} dev`}`,
        `${chalk.dim("Studio:")} pnpm exec shiro dev`,
      ].join("\n"),
      { borderColor: "white", padding: 1 }
    )
  );
}

async function devCommand(port: number | undefined): Promise<void> {
  const diagnostics = await collectDiagnostics();
  printDiagnostics(diagnostics);

  if (diagnostics.some((diagnostic) => diagnostic.status === "error")) {
    throwUserError("Fix the errors above before starting development.");
  }

  const configuredPort = port ?? (await readConfig()).studio?.port ?? 3001;
  const studioRoot = resolveStudioRoot();

  if (studioRoot === null) {
    throwUserError(
      [
        "Could not find @shiro/studio.",
        "Install it in this project:",
        "  pnpm add -D @shiro/studio",
        "Or reinstall the CLI (it depends on Studio):",
        "  pnpm add -D @shiro/cli",
      ].join("\n")
    );
  }

  console.log(chalk.bold(`Launching Shiro Studio on http://localhost:${String(configuredPort)}`));
  console.log(chalk.dim(`Studio root: ${studioRoot}`));

  const child = spawn(
    process.execPath,
    [join(studioRoot, "bin", "shiro-studio.mjs"), "dev", "-p", String(configuredPort)],
    {
      cwd: studioRoot,
      env: {
        ...process.env,
        PORT: String(configuredPort),
      },
      stdio: "inherit",
    }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function doctorCommand(): Promise<void> {
  printDiagnostics(await collectDiagnostics());
}

async function infoCommand(): Promise<void> {
  const packageJson = await readPackageJson();
  const config = await readConfig();
  const pluginNames = listInstalledPlugins(packageJson);

  console.log(chalk.bold("Shiro Info"));
  printKeyValue("CLI", `${VERSION} (@shiro/cli)`);
  printKeyValue("Project", packageJson?.name ?? "unknown");
  printKeyValue("Version", packageJson?.version ?? "unknown");
  printKeyValue("Provider", config.provider ?? "not configured");
  printKeyValue("Model", config.model ?? "not configured");
  printKeyValue("Plugins", pluginNames.length > 0 ? pluginNames.join(", ") : "none detected");
  printKeyValue("Studio", resolveStudioRoot() ?? "not found");
}

async function providersCommand(): Promise<void> {
  const packageJson = await readPackageJson();

  console.log(chalk.bold("Providers"));
  for (const provider of PROVIDERS) {
    const installed = hasDependency(packageJson, provider.dependency);
    const configured = provider.configKeys.some((key) => Boolean(process.env[key]));
    printProvider(provider, installed, configured);
  }
}

async function pluginsCommand(): Promise<void> {
  const packageJson = await readPackageJson();
  const plugins = listInstalledPlugins(packageJson);

  console.log(chalk.bold("Plugins"));
  if (plugins.length === 0) {
    printMuted("No Shiro plugins detected in package.json.");
    return;
  }

  for (const plugin of plugins) {
    const version =
      packageJson?.dependencies?.[plugin] ?? packageJson?.devDependencies?.[plugin] ?? "unknown";
    console.log(`${statusIcon("ok")} ${chalk.bold(plugin)} ${chalk.dim(version)}`);
  }
}

async function promptForInit(options: InitCommandOptions): Promise<InitAnswers> {
  const response = await prompts(
    [
      {
        choices: [
          { title: "pnpm", value: "pnpm" },
          { title: "npm", value: "npm" },
          { title: "yarn", value: "yarn" },
        ],
        initial: 0,
        message: "Package manager",
        name: "packageManager",
        type: options.packageManager === undefined ? "select" : null,
      },
      {
        choices: [{ title: "OpenAI", value: "openai" }],
        initial: 0,
        message: "Provider",
        name: "provider",
        type: options.provider === undefined ? "select" : null,
      },
      {
        initial: "gpt-5",
        message: "Model",
        name: "model",
        type: options.model === undefined ? "text" : null,
      },
      {
        choices: [
          { title: "TypeScript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
        ],
        initial: 0,
        message: "Language",
        name: "language",
        type: options.language === undefined ? "select" : null,
      },
    ],
    {
      onCancel: () => {
        throwUserError("Init cancelled.");
      },
    }
  );

  return {
    language: (options.language ??
      (typeof response.language === "string" ? response.language : "typescript")) as Language,
    model: options.model ?? (typeof response.model === "string" ? response.model : "gpt-5"),
    packageManager: (options.packageManager ??
      (typeof response.packageManager === "string"
        ? response.packageManager
        : "pnpm")) as PackageManager,
    provider: (options.provider ??
      (typeof response.provider === "string" ? response.provider : "openai")) as ProviderId,
  };
}

function defaultsForInit(options: InitCommandOptions): InitAnswers {
  return {
    language: options.language ?? "typescript",
    model: options.model ?? "gpt-5",
    packageManager: options.packageManager ?? "pnpm",
    provider: options.provider ?? "openai",
  };
}

async function writeProject(
  targetDir: string,
  targetName: string,
  answers: InitAnswers,
  installSpecs: InstallSpecs
): Promise<void> {
  const sourceExtension = answers.language === "typescript" ? "ts" : "js";
  await mkdir(join(targetDir, "src"), { recursive: true });
  await writeFile(join(targetDir, ".env.example"), envTemplate(), "utf8");
  await writeFile(
    join(targetDir, ".gitignore"),
    ["node_modules", ".env", ".shiro-packages", ""].join("\n"),
    "utf8"
  );
  await writeFile(join(targetDir, "README.md"), readmeTemplate(targetName, answers), "utf8");
  await writeFile(
    join(targetDir, "package.json"),
    packageJsonTemplate(targetName, answers, installSpecs),
    "utf8"
  );
  await writeFile(join(targetDir, "shiro.config.ts"), configTemplate(answers), "utf8");
  await writeFile(
    join(targetDir, "src", `agent.${sourceExtension}`),
    agentTemplate(answers),
    "utf8"
  );

  if (answers.language === "typescript") {
    await writeFile(join(targetDir, "tsconfig.json"), tsconfigTemplate(), "utf8");
  }
}

function runInstall(
  packageManager: PackageManager,
  cwd: string
): { readonly status: number | null } {
  return spawnSync(packageManager, ["install"], {
    cwd,
    shell: process.platform === "win32",
    stdio: "ignore",
  });
}

async function collectDiagnostics(): Promise<readonly Diagnostic[]> {
  const packageJson = await readPackageJson();
  const config = await readConfig();
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(checkNodeVersion());
  diagnostics.push(checkPackageManagers());
  diagnostics.push(checkProjectConfiguration(config));

  for (const provider of PROVIDERS) {
    const installed = hasDependency(packageJson, provider.dependency);
    const configured = provider.configKeys.some((key) => Boolean(process.env[key]));
    const diagnostic: Diagnostic = {
      message: `${provider.displayName}: ${installed ? "installed" : "not installed"}, ${
        configured ? "configured" : "missing API key"
      }`,
      status: installed && configured ? "ok" : "warning",
    };

    diagnostics.push(
      configured
        ? diagnostic
        : {
            ...diagnostic,
            suggestion: `Set ${provider.configKeys.join(" or ")} when using ${provider.displayName}.`,
          }
    );
  }

  const studioRoot = resolveStudioRoot();
  diagnostics.push(
    studioRoot === null
      ? {
          message: "@shiro/studio not found",
          status: "warning",
          suggestion: "Install with: pnpm add -D @shiro/studio  (or pnpm add -D @shiro/cli)",
        }
      : {
          message: `@shiro/studio found at ${studioRoot}`,
          status: "ok",
        }
  );

  return diagnostics;
}

function checkNodeVersion(): Diagnostic {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return major >= 22
    ? { message: `Node ${process.versions.node}`, status: "ok" }
    : {
        message: `Node ${process.versions.node}`,
        status: "error",
        suggestion: "Install Node.js 22 or newer.",
      };
}

function checkPackageManagers(): Diagnostic {
  const managers = ["pnpm", "npm", "yarn"].filter((manager) => commandExists(manager));
  return managers.length > 0
    ? { message: `Package managers: ${managers.join(", ")}`, status: "ok" }
    : {
        message: "No supported package manager found",
        status: "error",
        suggestion: "Install pnpm, npm, or yarn.",
      };
}

function checkProjectConfiguration(config: ShiroConfig): Diagnostic {
  return existsSync(resolve(process.cwd(), "shiro.config.ts"))
    ? {
        message: `Project configuration found${config.provider ? ` (${config.provider})` : ""}`,
        status: "ok",
      }
    : {
        message: "No shiro.config.ts found",
        status: "warning",
        suggestion: "Run shiro init or create shiro.config.ts in your project root.",
      };
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  return result.status === 0;
}

async function readPackageJson(): Promise<PackageJson | null> {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const content = await importJson(packageJsonPath);
  return isPackageJson(content) ? content : null;
}

async function readConfig(): Promise<ShiroConfig> {
  const configPath = resolve(process.cwd(), "shiro.config.ts");
  if (!existsSync(configPath)) {
    return {};
  }

  const text = await import("node:fs/promises").then((fs) => fs.readFile(configPath, "utf8"));
  const model = readStringProperty(text, "model");
  const provider = readStringProperty(text, "provider");
  const port = readNumberProperty(text, "port");
  return {
    ...(model === undefined ? {} : { model }),
    ...(provider === undefined ? {} : { provider }),
    ...(port === undefined ? {} : { studio: { port } }),
  };
}

async function importJson(path: string): Promise<unknown> {
  const text = await import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
  return JSON.parse(text) as unknown;
}

function isPackageJson(value: unknown): value is PackageJson {
  return typeof value === "object" && value !== null;
}

function hasDependency(packageJson: PackageJson | null, dependency: string): boolean {
  return Boolean(
    packageJson?.dependencies?.[dependency] ?? packageJson?.devDependencies?.[dependency]
  );
}

function listInstalledPlugins(packageJson: PackageJson | null): readonly string[] {
  const dependencyNames = [
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ];
  return dependencyNames.filter(
    (name) =>
      name.startsWith("@shiro/") &&
      name !== "@shiro/core" &&
      name !== "@shiro/cli" &&
      name !== "@shiro/studio" &&
      name !== "@shiro/shared"
  );
}

function printDiagnostics(diagnostics: readonly Diagnostic[]): void {
  console.log(chalk.bold("Shiro Doctor"));
  for (const diagnostic of diagnostics) {
    console.log(`${statusIcon(diagnostic.status)} ${diagnostic.message}`);
    if (diagnostic.suggestion !== undefined) {
      printMuted(`  ${diagnostic.suggestion}`);
    }
  }
}

function printProvider(provider: ProviderSummary, installed: boolean, configured: boolean): void {
  const status = installed && configured ? "ok" : "warning";
  console.log(
    `${statusIcon(status)} ${chalk.bold(provider.displayName)} ${chalk.dim(provider.packageName)} ` +
      `${installed ? chalk.green("installed") : chalk.yellow("missing")} ` +
      (configured ? chalk.green("configured") : chalk.dim("not configured"))
  );
}

function statusIcon(status: CheckStatus): string {
  if (status === "ok") {
    return chalk.green("✓ OK");
  }

  if (status === "warning") {
    return chalk.yellow("⚠ Warning");
  }

  return chalk.red("✗ Error");
}

function printKeyValue(key: string, value: string): void {
  console.log(`${chalk.dim(`${key}:`)} ${value}`);
}

function printMuted(message: string): void {
  console.log(chalk.dim(message));
}

function throwUserError(message: string): never {
  console.error(chalk.red(message));
  process.exit(1);
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Port must be a positive integer.");
  }

  return port;
}

function parsePackageManager(value: string): PackageManager {
  return parseChoice(value, ["pnpm", "npm", "yarn"], "pnpm");
}

function parseProvider(value: string): ProviderId {
  return parseChoice(value, ["openai"], "openai");
}

function parseLanguage(value: string): Language {
  return parseChoice(value, ["typescript", "javascript"], "typescript");
}

function parseChoice<const T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && choices.includes(value as T) ? (value as T) : fallback;
}

function readStringProperty(source: string, key: string): string | undefined {
  const match = new RegExp(`${key}:\\s*["'\`]([^"'\`]+)["'\`]`).exec(source);
  return match?.[1];
}

function readNumberProperty(source: string, key: string): number | undefined {
  const match = new RegExp(`${key}:\\s*(\\d+)`).exec(source);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

/** Returns monorepo root when present (from cwd or this CLI install), otherwise null. */
function findWorkspaceRootOptional(): string | null {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];

  for (const start of starts) {
    let current = start;
    for (;;) {
      if (existsSync(join(current, "pnpm-workspace.yaml"))) {
        return current;
      }
      const parent = resolve(current, "..");
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return null;
}

/** Build local packages when scaffolding with file: deps so exports resolve. */
function ensureLocalPackagesBuilt(): void {
  const workspaceRoot = findWorkspaceRootOptional();
  if (workspaceRoot === null) {
    return;
  }

  const packages = ["packages/core", "packages/openai", "packages/cli"] as const;
  for (const packageDir of packages) {
    const distEntry = join(workspaceRoot, packageDir, "dist", "index.js");
    if (existsSync(distEntry)) {
      continue;
    }
    const result = spawnSync("pnpm", ["--filter", packageFilter(packageDir), "build"], {
      cwd: workspaceRoot,
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    if (result.status !== 0) {
      printMuted(`Warning: could not build ${packageDir}. Run pnpm build in the monorepo.`);
    }
  }
}

function packageFilter(packageDir: string): string {
  if (packageDir.endsWith("core")) return "@shiro/core";
  if (packageDir.endsWith("openai")) return "@shiro/openai";
  if (packageDir.endsWith("cli")) return "@shiro/cli";
  return packageDir;
}

/**
 * Resolve @shiro/studio for consumer projects and monorepo development.
 * Order: project node_modules → CLI node_modules → monorepo apps/studio.
 */
function resolveStudioRoot(): string | null {
  const candidates: string[] = [];

  const fromCwd = resolve(process.cwd(), "node_modules", "@shiro", "studio");
  candidates.push(fromCwd);

  try {
    const resolved = REQUIRE.resolve("@shiro/studio/package.json");
    candidates.push(dirname(resolved));
  } catch {
    // not linked to this CLI install
  }

  const workspaceRoot = findWorkspaceRootOptional();
  if (workspaceRoot !== null) {
    candidates.push(join(workspaceRoot, "apps", "studio"));
  }

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, "package.json")) &&
      existsSync(join(candidate, "bin", "shiro-studio.mjs"))
    ) {
      return candidate;
    }
  }

  return null;
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

function installCommandFor(packageManager: PackageManager): string {
  return packageManager === "npm" ? "npm install" : `${packageManager} install`;
}

interface InstallSpecs {
  readonly cli: string;
  readonly core: string;
  readonly openai: string;
  readonly studio: string;
}

/**
 * Prefer vendored local monorepo packages so `pnpm install` works before npm publish.
 * Copies built package contents and rewrites @shiro/* deps to sibling file: folders.
 */
async function resolveInstallSpecs(targetDir: string): Promise<InstallSpecs> {
  const workspaceRoot = findWorkspaceRootOptional();
  if (workspaceRoot === null) {
    return {
      cli: `^${VERSION}`,
      core: `^${VERSION}`,
      openai: `^${VERSION}`,
      studio: `^${VERSION}`,
    };
  }

  const vendorDir = join(targetDir, ".shiro-packages");
  await mkdir(vendorDir, { recursive: true });

  vendorPackage(workspaceRoot, "packages/core", vendorDir, "shiro-core", []);
  vendorPackage(workspaceRoot, "packages/openai", vendorDir, "shiro-openai", [
    { name: "@shiro/core", folder: "shiro-core" },
  ]);
  vendorPackage(workspaceRoot, "packages/cli", vendorDir, "shiro-cli", []);
  vendorPackage(workspaceRoot, "apps/studio", vendorDir, "shiro-studio", []);

  return {
    core: "file:.shiro-packages/shiro-core",
    openai: "file:.shiro-packages/shiro-openai",
    cli: "file:.shiro-packages/shiro-cli",
    studio: "file:.shiro-packages/shiro-studio",
  };
}

function vendorPackage(
  workspaceRoot: string,
  packageDir: string,
  vendorDir: string,
  folderName: string,
  localDeps: readonly { readonly name: string; readonly folder: string }[]
): void {
  const source = join(workspaceRoot, packageDir);
  const destination = join(vendorDir, folderName);
  mkdirSync(destination, { recursive: true });

  const packageJsonPath = join(source, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    files?: string[];
  };

  const entries = packageJson.files ?? ["dist"];
  for (const entry of entries) {
    const from = join(source, entry);
    const to = join(destination, entry);
    if (!existsSync(from)) {
      continue;
    }
    cpSync(from, to, { recursive: true });
  }

  for (const fileName of ["package.json", "README.md", "LICENSE"]) {
    const from = join(source, fileName);
    if (existsSync(from)) {
      cpSync(from, join(destination, fileName));
    }
  }

  // Studio also needs config files for Next.js.
  if (folderName === "shiro-studio") {
    for (const fileName of ["next.config.mjs", "postcss.config.mjs", "tsconfig.json"]) {
      const from = join(source, fileName);
      if (existsSync(from)) {
        cpSync(from, join(destination, fileName));
      }
    }
  }

  const vendoredPackageJsonPath = join(destination, "package.json");
  const vendored = JSON.parse(readFileSync(vendoredPackageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  if (vendored.dependencies !== undefined) {
    for (const dep of localDeps) {
      if (vendored.dependencies[dep.name] !== undefined) {
        vendored.dependencies[dep.name] = `file:../${dep.folder}`;
      }
    }
  }

  // Drop workspace-only build tooling from consumer installs.
  delete vendored.devDependencies;
  writeFileSync(vendoredPackageJsonPath, `${JSON.stringify(vendored, null, 2)}\n`, "utf8");
}

function envTemplate(): string {
  return "OPENAI_API_KEY=\n";
}

function packageJsonTemplate(
  name: string,
  answers: InitAnswers,
  installSpecs: InstallSpecs
): string {
  const scripts =
    answers.language === "typescript"
      ? {
          build: "tsc --noEmit",
          dev: "tsx src/agent.ts",
          studio: "shiro dev",
        }
      : {
          dev: "node src/agent.js",
          studio: "shiro dev",
        };

  return `${JSON.stringify(
    {
      dependencies: {
        "@shiro/core": installSpecs.core,
        "@shiro/openai": installSpecs.openai,
        dotenv: "^17.2.1",
        zod: "^4.0.0",
      },
      devDependencies: {
        "@shiro/cli": installSpecs.cli,
        "@shiro/studio": installSpecs.studio,
        ...(answers.language === "typescript" ? { tsx: "^4.20.6", typescript: "^5.9.2" } : {}),
      },
      name,
      private: true,
      scripts,
      type: "module",
      version: "0.0.0",
    },
    null,
    2
  )}\n`;
}

function tsconfigTemplate(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        exactOptionalPropertyTypes: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noUncheckedIndexedAccess: true,
        strict: true,
        target: "ES2023",
      },
      include: ["src", "shiro.config.ts"],
    },
    null,
    2
  )}\n`;
}

function configTemplate(answers: InitAnswers): string {
  return `export default {
  provider: "${answers.provider}",
  model: "${answers.model}",
  studio: {
    port: 3001,
  },
} as const;
`;
}

function agentTemplate(answers: InitAnswers): string {
  return `import "dotenv/config";
import { Agent, Engine } from "@shiro/core";
import { OpenAIPlugin } from "@shiro/openai";

const engine = new Engine();

engine.use(
  new OpenAIPlugin({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "${answers.model}",
  })
);

const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful AI assistant.",
  provider: "openai",
});

const result = await engine.execute(agent, "Hello!");

console.log(result.output);
`;
}

function readmeTemplate(name: string, answers: InitAnswers): string {
  const run = answers.packageManager === "npm" ? "npm run" : answers.packageManager;
  return `# ${name}

A Shiro agent project using ${answers.provider} and ${answers.model}.

## Setup

\`\`\`bash
cp .env.example .env
# set OPENAI_API_KEY
${answers.packageManager === "npm" ? "npm install" : `${answers.packageManager} install`}
\`\`\`

## Run the agent

\`\`\`bash
${run} dev
\`\`\`

## Open Studio

\`\`\`bash
${run} studio
\`\`\`

Studio inspects sample traces and imported JSON exports. See https://github.com/${GITHUB_REPO}.
`;
}
