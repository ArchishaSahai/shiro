#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import boxen from "boxen";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";

const VERSION = "0.0.0";
const PROVIDERS: readonly ProviderSummary[] = [
  {
    configKeys: ["OPENAI_API_KEY"],
    dependency: "@shiro/openai",
    displayName: "OpenAI",
    packageName: "@shiro/openai",
    providerId: "openai",
  },
  {
    configKeys: ["ANTHROPIC_API_KEY"],
    dependency: "@shiro/anthropic",
    displayName: "Anthropic",
    packageName: "@shiro/anthropic",
    providerId: "anthropic",
  },
  {
    configKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    dependency: "@shiro/gemini",
    displayName: "Gemini",
    packageName: "@shiro/gemini",
    providerId: "gemini",
  },
];

type PackageManager = "pnpm" | "npm" | "yarn";
type Language = "typescript" | "javascript";
type ProviderId = "openai" | "anthropic" | "gemini";
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
  .description("Developer tooling for Shiro agent projects.")
  .version(VERSION, "-v, --version", "Display the Shiro CLI version.");

program
  .command("init")
  .argument("[name]", "Project directory")
  .description("Scaffold a new Shiro agent project.")
  .option("--package-manager <manager>", "Package manager: pnpm, npm, or yarn", parsePackageManager)
  .option("--provider <provider>", "Provider: openai, anthropic, or gemini", parseProvider)
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
  const answers = options.yes ? defaultsForInit(options) : await promptForInit(name, options);
  const targetName = name ?? "my-agent";
  const targetDir = resolve(process.cwd(), targetName);

  if (existsSync(targetDir)) {
    throwUserError(`Directory already exists: ${targetName}`);
  }

  const spinner = ora(`Creating ${targetName}`).start();
  await writeProject(targetDir, targetName, answers);
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
    }
  }

  console.log(
    boxen(
      [
        chalk.bold("Shiro project ready"),
        "",
        `${chalk.dim("Next:")} cd ${targetName}`,
        `${chalk.dim("Then:")} ${answers.packageManager === "npm" ? "npm run dev" : `${answers.packageManager} dev`}`,
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
  console.log(chalk.bold(`Launching Shiro Studio on http://localhost:${String(configuredPort)}`));
  const child = spawn("pnpm", ["--filter", "@shiro/studio", "dev", "-p", String(configuredPort)], {
    cwd: findWorkspaceRoot(),
    shell: process.platform === "win32",
    stdio: "inherit",
  });

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
  printKeyValue("CLI", VERSION);
  printKeyValue("Project", packageJson?.name ?? "unknown");
  printKeyValue("Version", packageJson?.version ?? "unknown");
  printKeyValue("Provider", config.provider ?? "not configured");
  printKeyValue("Model", config.model ?? "not configured");
  printKeyValue("Plugins", pluginNames.length > 0 ? pluginNames.join(", ") : "none detected");
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

async function promptForInit(
  name: string | undefined,
  options: InitCommandOptions
): Promise<InitAnswers> {
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
        type: "select",
      },
      {
        choices: [
          { title: "OpenAI", value: "openai" },
          { title: "Anthropic", value: "anthropic" },
          { title: "Gemini", value: "gemini" },
        ],
        initial: 0,
        message: "Provider",
        name: "provider",
        type: "select",
      },
      {
        initial: "gpt-5",
        message: "Model",
        name: "model",
        type: "text",
      },
      {
        choices: [
          { title: "TypeScript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
        ],
        initial: 0,
        message: "Language",
        name: "language",
        type: "select",
      },
    ],
    {
      onCancel: () => {
        throwUserError("Initialization cancelled.");
      },
    }
  );

  const packageManager =
    options.packageManager ?? parseChoice(response.packageManager, ["pnpm", "npm", "yarn"], "pnpm");
  const provider =
    options.provider ?? parseChoice(response.provider, ["openai", "anthropic", "gemini"], "openai");
  const language =
    options.language ?? parseChoice(response.language, ["typescript", "javascript"], "typescript");

  if (name === undefined) {
    printMuted("No project name supplied, using my-agent.");
  }

  return {
    language,
    model:
      options.model ??
      (typeof response.model === "string" && response.model.length > 0 ? response.model : "gpt-5"),
    packageManager,
    provider,
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
  answers: InitAnswers
): Promise<void> {
  const sourceExtension = answers.language === "typescript" ? "ts" : "js";
  await mkdir(join(targetDir, "src"), { recursive: true });
  await writeFile(join(targetDir, ".env.example"), envTemplate(answers.provider), "utf8");
  await writeFile(join(targetDir, "README.md"), readmeTemplate(targetName, answers), "utf8");
  await writeFile(
    join(targetDir, "package.json"),
    packageJsonTemplate(targetName, answers),
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
  const command = packageManager;
  const args = packageManager === "npm" ? ["install"] : ["install"];
  return spawnSync(command, args, { cwd, shell: process.platform === "win32", stdio: "ignore" });
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
  return dependencyNames.filter((name) => name.startsWith("@shiro/") && name !== "@shiro/core");
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
  const status = installed && configured ? "ok" : installed ? "warning" : "warning";
  console.log(
    `${statusIcon(status)} ${chalk.bold(provider.displayName)} ${chalk.dim(provider.packageName)} ` +
      `${installed ? chalk.green("installed") : chalk.yellow("available")} ` +
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
  return parseChoice(value, ["openai", "anthropic", "gemini"], "openai");
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

function findWorkspaceRoot(): string {
  let current = process.cwd();
  while (!existsSync(join(current, "pnpm-workspace.yaml"))) {
    const parent = resolve(current, "..");
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
  return current;
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

function installCommandFor(packageManager: PackageManager): string {
  return packageManager === "npm" ? "npm install" : `${packageManager} install`;
}

function providerPackage(provider: ProviderId): string {
  return provider === "openai" ? "@shiro/openai" : `@shiro/${provider}`;
}

function envTemplate(provider: ProviderId): string {
  const key =
    provider === "openai"
      ? "OPENAI_API_KEY"
      : provider === "anthropic"
        ? "ANTHROPIC_API_KEY"
        : "GEMINI_API_KEY";
  return `${key}=\n`;
}

function packageJsonTemplate(name: string, answers: InitAnswers): string {
  const scripts =
    answers.language === "typescript"
      ? {
          build: "tsc --noEmit",
          dev: "tsx src/agent.ts",
        }
      : {
          dev: "node src/agent.js",
        };

  return `${JSON.stringify(
    {
      dependencies: {
        "@shiro/core": "latest",
        [providerPackage(answers.provider)]: "latest",
        dotenv: "^17.2.1",
      },
      devDependencies:
        answers.language === "typescript" ? { tsx: "^4.20.6", typescript: "^5.9.2" } : undefined,
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
  const providerImport =
    answers.provider === "openai" ? 'import { OpenAIPlugin } from "@shiro/openai";\n' : "";
  const plugin =
    answers.provider === "openai"
      ? `engine.use(
  new OpenAIPlugin({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "${answers.model}",
  })
);
`
      : `// Install @shiro/${answers.provider} when the provider package is available.
`;

  return `import "dotenv/config";
import { Agent, Engine } from "@shiro/core";
${providerImport}
const engine = new Engine();

${plugin}
const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful AI assistant.",
  provider: "${answers.provider}",
});

const result = await engine.execute(agent, "Hello!");

console.log(result.output);
`;
}

function readmeTemplate(name: string, answers: InitAnswers): string {
  return `# ${name}

A Shiro agent project using ${answers.provider} and ${answers.model}.

## Development

\`\`\`bash
cp .env.example .env
${answers.packageManager === "npm" ? "npm run dev" : `${answers.packageManager} dev`}
\`\`\`
`;
}
