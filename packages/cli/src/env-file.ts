import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Line-oriented .env helpers that preserve comments, blank lines, and unrelated keys.
 * Values are never logged by these functions.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function quoteEnvValue(value: string): string {
  if (value.length === 0) {
    return "";
  }
  if (/[\s#"']/.test(value) || value.includes("\\") || value.includes("\n")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function parseEnvLine(line: string): { key: string; prefix: string } | null {
  const match = /^(?<prefix>\s*(?:export\s+)?)(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
  if (match?.groups === undefined) {
    return null;
  }
  const trimmedStart = line.trimStart();
  if (trimmedStart.startsWith("#")) {
    return null;
  }
  return { key: match.groups.key ?? "", prefix: match.groups.prefix ?? "" };
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(rawLine);
    if (parsed === null) {
      continue;
    }
    const eq = rawLine.indexOf("=");
    if (eq === -1) {
      continue;
    }
    let value = rawLine.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    result[parsed.key] = value;
  }
  return result;
}

/**
 * Update or append KEY=value while preserving comments, ordering, and other vars.
 */
export function upsertEnvVar(content: string, key: string, value: string): string {
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  const keyPattern = new RegExp(`^(\\s*(?:export\\s+)?)${escapeRegExp(key)}\\s*=`);
  let found = false;
  const next: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith("#")) {
      next.push(line);
      continue;
    }
    const match = keyPattern.exec(line);
    if (match === null) {
      next.push(line);
      continue;
    }
    found = true;
    const prefix = match[1] ?? "";
    next.push(`${prefix}${key}=${quoteEnvValue(value)}`);
  }

  if (!found) {
    next.push(`${key}=${quoteEnvValue(value)}`);
  }

  let serialized = next.join("\n");
  if (!serialized.endsWith("\n")) {
    serialized += "\n";
  }
  return serialized;
}

export function readEnvFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return "";
  }
  return readFileSync(filePath, "utf8");
}

export function writeEnvVar(filePath: string, key: string, value: string): void {
  const existing = readEnvFile(filePath);
  const next = upsertEnvVar(existing, key, value);
  writeFileSync(filePath, next, "utf8");
}

export function getEnvFileValue(filePath: string, key: string): string | undefined {
  const vars = parseEnvFile(readEnvFile(filePath));
  const value = vars[key];
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  return value;
}

/**
 * Load .env into process.env without overriding variables already set in the environment.
 */
export function loadProjectEnv(cwd: string = process.cwd()): void {
  const filePath = resolve(cwd, ".env");
  if (!existsSync(filePath)) {
    return;
  }
  const vars = parseEnvFile(readEnvFile(filePath));
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] ??= value;
  }
}

export function resolveProviderKey(
  envVar: string,
  cwd: string = process.cwd()
): string | undefined {
  const fromProcess = process.env[envVar];
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  return getEnvFileValue(resolve(cwd, ".env"), envVar);
}
