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
 * Order: process environment → .env file (when present with a non-empty value).
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

/**
 * For brand-new projects: only the process environment can skip the prompt.
 * An empty seeded `.env` must never count as "configured".
 */
export function detectProcessCredential(providerId: ProviderId): DetectedCredential | null {
  const credential = getProviderCredential(providerId);
  const fromProcess = process.env[credential.envVar];
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return { apiKey: fromProcess.trim(), source: "environment" };
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
  /**
   * Explicit interactivity. When set, overrides live TTY checks.
   * Init must pass the value captured *before* spinners/pack installs, because
   * `process.stdin.isTTY` can flip false after `prompts` / `ora` run.
   */
  readonly interactive?: boolean;
  /** Persist prompted keys to .env (default true). */
  readonly persist?: boolean;
  /** Require a key when prompting (default false for init, true for auth/dev). */
  readonly required?: boolean;
  /** Project directory that owns .env */
  readonly projectDir?: string;
  /**
   * When true (init of a brand-new directory), only process env skips the prompt.
   * Ignores any on-disk `.env` so a freshly seeded empty file cannot suppress prompting.
   */
  readonly processEnvOnly?: boolean;
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
  const interactive = options.interactive ?? isInteractiveTerminal();

  if (!forcePrompt) {
    const existing = options.processEnvOnly
      ? detectProcessCredential(providerId)
      : detectExistingCredential(providerId, projectDir);
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
    if (persist) {
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
 * Init credential step — runs immediately after provider/model selection.
 *
 * Must receive the interactivity flag captured at the start of `init` so a later
 * false `stdin.isTTY` (common after `prompts`/`ora`) cannot skip the API key prompt.
 *
 * Does not write `.env` yet (`persist: false`); `writeProject` materializes it.
 */
export async function collectInitCredentials(options: {
  readonly interactive: boolean;
  readonly providerId: ProviderId;
}): Promise<CredentialPromptResult> {
  return configureProviderCredentials(options.providerId, {
    interactive: options.interactive,
    persist: false,
    processEnvOnly: true,
    required: false,
  });
}

/**
 * Non-interactive / `-y` init: use process env if present; otherwise leave key empty.
 * Caller writes `.env` via `writeProject`.
 */
export function applyNonInteractiveInitCredentials(providerId: ProviderId): CredentialPromptResult {
  const credential = getProviderCredential(providerId);
  const existing = detectProcessCredential(providerId);
  if (existing !== null) {
    process.env[credential.envVar] = existing.apiKey;
    console.log(chalk.green(`✓ ${credential.displayName} API key detected from environment.`));
    return {
      apiKey: existing.apiKey,
      configured: true,
      source: existing.source,
      verified: null,
    };
  }

  printNoApiKeyHint(false);
  return { apiKey: null, configured: false, source: "none", verified: null };
}

/**
 * Persist the init credential result into the project `.env` (create or update).
 */
export function writeInitEnvFile(
  projectDir: string,
  providerId: ProviderId,
  apiKey: string | null
): void {
  const credential = getProviderCredential(providerId);
  writeEnvVar(resolve(projectDir, ".env"), credential.envVar, apiKey ?? "");
  writeEnvVar(resolve(projectDir, ".env"), "SHIRO_STUDIO_URL", "ws://127.0.0.1:4317");
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

  const interactive = isInteractiveTerminal();
  const result = await configureProviderCredentials(providerId, {
    forcePrompt: interactive,
    interactive,
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
