import { resolve } from "node:path";
import chalk from "chalk";
import prompts from "prompts";
import { getEnvFileValue, writeEnvVar } from "./env-file.js";
import { getProviderCredential, type ProviderId } from "./providers.js";

export type CredentialSource = "environment" | "env-file" | "prompt" | "none";

export interface CredentialPromptResult {
  readonly apiKey: string | null;
  readonly configured: boolean;
  readonly source: CredentialSource;
  readonly verified: boolean | null;
}

export interface DetectedCredential {
  readonly apiKey: string;
  readonly source: "environment" | "env-file";
}

function onCancel(): never {
  console.log();
  console.error(chalk.red("Cancelled."));
  process.exit(1);
}

export function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

/**
 * Resolve a provider key without mutating process.env.
 * Order: process environment → .env file.
 */
export function detectExistingCredential(
  providerId: ProviderId,
  cwd: string = process.cwd()
): DetectedCredential | null {
  const credential = getProviderCredential(providerId);
  const fromProcess = process.env[credential.envVar];
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return { apiKey: fromProcess.trim(), source: "environment" };
  }
  const fromFile = getEnvFileValue(resolve(cwd, ".env"), credential.envVar);
  if (fromFile !== undefined) {
    return { apiKey: fromFile, source: "env-file" };
  }
  return null;
}

export function formatCredentialSuccessLine(
  providerId: ProviderId,
  source: CredentialSource
): string {
  const { displayName } = getProviderCredential(providerId);
  switch (source) {
    case "environment":
      return `✔ Using ${displayName} API key from environment`;
    case "env-file":
      return `✔ Using ${displayName} API key from .env`;
    case "prompt":
      return `✔ ${displayName} API key configured`;
    case "none":
      return `⚠ ${displayName} API key not configured`;
  }
}

/**
 * Prompt for a provider API key (masked). Empty / whitespace-only skips unless required.
 * Never logs the key value.
 */
export async function promptForApiKey(
  providerId: ProviderId,
  options: { readonly required?: boolean } = {}
): Promise<string | null> {
  const credential = getProviderCredential(providerId);
  const required = options.required === true;

  const response = await prompts(
    {
      message: required
        ? `Enter your ${credential.displayName} API key`
        : `Enter your ${credential.displayName} API key (leave blank to skip)`,
      name: "apiKey",
      type: "password",
      validate: (value: string) => {
        if (typeof value !== "string") {
          return "Invalid input";
        }
        if (value.trim().length === 0) {
          return required ? "API key is required" : true;
        }
        return true;
      },
    },
    { onCancel }
  );

  const raw = typeof response.apiKey === "string" ? response.apiKey : "";
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

export async function promptVerifyApiKey(): Promise<boolean> {
  const response = await prompts(
    {
      choices: [
        { title: "No", value: false },
        { title: "Yes", value: true },
      ],
      initial: 0,
      message: "Verify API key now?",
      name: "verify",
      type: "select",
    },
    { onCancel }
  );
  return response.verify === true;
}

export async function verifyApiKey(providerId: ProviderId, apiKey: string): Promise<boolean> {
  const credential = getProviderCredential(providerId);
  if (credential.verify === undefined) {
    return true;
  }
  return credential.verify(apiKey);
}

async function promptAndOptionallyVerify(
  providerId: ProviderId,
  options: { readonly required: boolean }
): Promise<{ apiKey: string | null; verified: boolean | null }> {
  for (;;) {
    const apiKey = await promptForApiKey(providerId, { required: options.required });
    if (apiKey === null) {
      return { apiKey: null, verified: null };
    }

    let verified: boolean | null = null;
    const shouldVerify = await promptVerifyApiKey();
    if (!shouldVerify) {
      return { apiKey, verified: null };
    }

    const ok = await verifyApiKey(providerId, apiKey);
    verified = ok;
    if (ok) {
      console.log(chalk.green("✓ API key verified"));
      return { apiKey, verified };
    }

    console.log(chalk.red("✖ Verification failed"));
    const retry = await prompts(
      {
        choices: [
          { title: "Retry", value: true },
          { title: "Continue without verifying", value: false },
        ],
        initial: 0,
        message: "Try again?",
        name: "retry",
        type: "select",
      },
      { onCancel }
    );
    if (retry.retry === true) {
      continue;
    }
    return { apiKey, verified: false };
  }
}

function printNoApiKeyHint(interactive: boolean): void {
  console.log();
  if (interactive) {
    console.log(chalk.yellow("⚠ No API key configured."));
    console.log(
      chalk.dim(
        "You can add one later by editing .env or Shiro will ask again when you first run the project."
      )
    );
    return;
  }
  console.log(chalk.yellow("No API key detected."));
  console.log(chalk.dim("Configure one later in .env or your environment."));
}

export interface ConfigureCredentialsOptions {
  /** When true, always prompt (unless non-interactive) even if a key already exists. */
  readonly forcePrompt?: boolean;
  /** Persist prompted keys to .env (default true). */
  readonly persist?: boolean;
  /** Require a key when prompting (default false for init, true for auth/dev). */
  readonly required?: boolean;
  /** Project directory that owns .env */
  readonly projectDir?: string;
}

/**
 * Shared credential onboarding used by init, auth, and dev.
 */
export async function configureProviderCredentials(
  providerId: ProviderId,
  options: ConfigureCredentialsOptions = {}
): Promise<CredentialPromptResult> {
  const projectDir = options.projectDir ?? process.cwd();
  const envPath = resolve(projectDir, ".env");
  const credential = getProviderCredential(providerId);
  const persist = options.persist !== false;
  const forcePrompt = options.forcePrompt === true;
  const required = options.required === true;
  const interactive = isInteractiveTerminal();

  if (!forcePrompt) {
    const existing = detectExistingCredential(providerId, projectDir);
    if (existing !== null) {
      process.env[credential.envVar] = existing.apiKey;
      if (existing.source === "environment") {
        console.log(chalk.green(`✓ ${credential.displayName} API key detected from environment.`));
      } else {
        console.log(chalk.green(`✓ ${credential.displayName} API key detected from .env.`));
      }
      return {
        apiKey: existing.apiKey,
        configured: true,
        source: existing.source,
        verified: null,
      };
    }
  }

  if (!interactive) {
    if (persist && !forcePrompt) {
      const current = getEnvFileValue(envPath, credential.envVar);
      if (current === undefined) {
        writeEnvVar(envPath, credential.envVar, "");
      }
    }
    printNoApiKeyHint(false);
    return { apiKey: null, configured: false, source: "none", verified: null };
  }

  const prompted = await promptAndOptionallyVerify(providerId, { required });
  if (prompted.apiKey === null) {
    if (persist) {
      writeEnvVar(envPath, credential.envVar, "");
    }
    printNoApiKeyHint(true);
    return { apiKey: null, configured: false, source: "none", verified: null };
  }

  if (persist) {
    writeEnvVar(envPath, credential.envVar, prompted.apiKey);
  }
  process.env[credential.envVar] = prompted.apiKey;
  return {
    apiKey: prompted.apiKey,
    configured: true,
    source: "prompt",
    verified: prompted.verified,
  };
}

/**
 * Non-interactive / `-y` init: use env if present, otherwise leave empty placeholder.
 */
export function applyNonInteractiveInitCredentials(
  providerId: ProviderId,
  projectDir: string
): CredentialPromptResult {
  const credential = getProviderCredential(providerId);
  const existing = detectExistingCredential(providerId, projectDir);
  if (existing !== null) {
    process.env[credential.envVar] = existing.apiKey;
    if (existing.source === "environment") {
      console.log(chalk.green(`✓ ${credential.displayName} API key detected from environment.`));
    } else {
      console.log(chalk.green(`✓ ${credential.displayName} API key detected from .env.`));
    }
    return {
      apiKey: existing.apiKey,
      configured: true,
      source: existing.source,
      verified: null,
    };
  }

  writeEnvVar(resolve(projectDir, ".env"), credential.envVar, "");
  printNoApiKeyHint(false);
  return { apiKey: null, configured: false, source: "none", verified: null };
}

/**
 * Dev-time: ensure the configured provider key is available (prompt + optional persist).
 */
export async function ensureProviderApiKeyForDev(providerId: ProviderId): Promise<void> {
  const credential = getProviderCredential(providerId);
  const existing = detectExistingCredential(providerId);
  if (existing !== null) {
    process.env[credential.envVar] = existing.apiKey;
    return;
  }

  if (!isInteractiveTerminal()) {
    console.log();
    console.log(chalk.yellow(`No ${credential.displayName} API key found.`));
    console.log(chalk.dim("Configure one later in .env or your environment."));
    return;
  }

  console.log();
  console.log(chalk.yellow(`No ${credential.displayName} API key found.`));
  console.log();

  const prompted = await promptAndOptionallyVerify(providerId, { required: true });
  if (prompted.apiKey === null) {
    return;
  }

  const save = await prompts(
    {
      choices: [
        { title: "Yes", value: true },
        { title: "No (use only for this session)", value: false },
      ],
      initial: 0,
      message: "Save this to .env?",
      name: "save",
      type: "select",
    },
    { onCancel }
  );

  process.env[credential.envVar] = prompted.apiKey;

  if (save.save === true) {
    writeEnvVar(resolve(process.cwd(), ".env"), credential.envVar, prompted.apiKey);
    console.log(chalk.dim(`Saved ${credential.envVar} to .env`));
  }
}

/**
 * `shiro auth` — configure credentials for the current project provider.
 */
export async function runAuthCommand(providerId: ProviderId): Promise<CredentialPromptResult> {
  const credential = getProviderCredential(providerId);
  console.log(chalk.bold(`Configure ${credential.displayName} credentials`));
  console.log(chalk.dim(`Environment variable: ${credential.envVar}`));
  console.log();

  const result = await configureProviderCredentials(providerId, {
    forcePrompt: isInteractiveTerminal(),
    persist: true,
    required: true,
  });

  if (result.configured) {
    console.log();
    console.log(chalk.green(formatCredentialSuccessLine(providerId, result.source)));
    if (result.source === "prompt") {
      console.log(chalk.dim(`Saved ${credential.envVar} to .env`));
    }
  }

  return result;
}
