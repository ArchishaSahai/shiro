import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("prompts", () => ({
  default: vi.fn(),
}));

import prompts from "prompts";
import {
  collectInitCredentials,
  configureProviderCredentials,
  detectProcessCredential,
  writeInitEnvFile,
} from "./credentials.js";
import { getEnvFileValue, parseEnvFile } from "./env-file.js";

const promptsMock = vi.mocked(prompts);
const envVar = "OPENAI_API_KEY";

describe("fresh init credential onboarding", () => {
  const previous = process.env[envVar];
  let projectDir = "";

  beforeEach(() => {
    Reflect.deleteProperty(process.env, envVar);
    projectDir = join(tmpdir(), `shiro-init-cred-${String(process.pid)}-${String(Date.now())}`);
    mkdirSync(projectDir, { recursive: true });
    promptsMock.mockReset();
  });

  afterEach(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, envVar);
    } else {
      process.env[envVar] = previous;
    }
    if (existsSync(projectDir)) {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("prompts when neither process env nor .env exists (fresh project)", async () => {
    expect(detectProcessCredential("openai")).toBeNull();
    expect(existsSync(join(projectDir, ".env"))).toBe(false);

    promptsMock
      .mockResolvedValueOnce({ apiKey: "sk-test-fresh" })
      .mockResolvedValueOnce({ verify: false });

    const result = await collectInitCredentials({
      interactive: true,
      providerId: "openai",
    });

    expect(promptsMock).toHaveBeenCalled();
    expect(result).toMatchObject({
      apiKey: "sk-test-fresh",
      configured: true,
      source: "prompt",
    });

    writeInitEnvFile(projectDir, "openai", result.apiKey);
    expect(existsSync(join(projectDir, ".env"))).toBe(true);
    expect(getEnvFileValue(join(projectDir, ".env"), envVar)).toBe("sk-test-fresh");
    expect(parseEnvFile(readFileSync(join(projectDir, ".env"), "utf8")).SHIRO_STUDIO_URL).toBe(
      "ws://127.0.0.1:4317"
    );
  });

  it("creates .env with an empty provider key when the user skips", async () => {
    promptsMock.mockResolvedValueOnce({ apiKey: "" });

    const result = await collectInitCredentials({
      interactive: true,
      providerId: "openai",
    });

    expect(result.source).toBe("none");
    expect(result.apiKey).toBeNull();

    writeInitEnvFile(projectDir, "openai", result.apiKey);
    const envPath = join(projectDir, ".env");
    expect(existsSync(envPath)).toBe(true);
    expect(readFileSync(envPath, "utf8")).toContain("OPENAI_API_KEY=");
    expect(getEnvFileValue(envPath, envVar)).toBeUndefined();
  });

  it("skips prompting when process env already has the key", async () => {
    process.env[envVar] = "sk-from-shell";

    const result = await collectInitCredentials({
      interactive: true,
      providerId: "openai",
    });

    expect(promptsMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      apiKey: "sk-from-shell",
      configured: true,
      source: "environment",
    });
  });

  it("still prompts for a fresh project even if interactive TTY would later be false", async () => {
    // Simulate the regression: caller captured interactive=true before ora/prompts flipped TTY.
    promptsMock
      .mockResolvedValueOnce({ apiKey: "sk-after-tty-flip" })
      .mockResolvedValueOnce({ verify: false });

    const result = await configureProviderCredentials("openai", {
      interactive: true,
      persist: false,
      processEnvOnly: true,
      required: false,
    });

    expect(promptsMock).toHaveBeenCalled();
    expect(result.source).toBe("prompt");
    expect(result.apiKey).toBe("sk-after-tty-flip");
  });

  it("does not treat an empty on-disk .env as configured during init", async () => {
    writeFileSync(
      join(projectDir, ".env"),
      "OPENAI_API_KEY=\nSHIRO_STUDIO_URL=ws://127.0.0.1:4317\n"
    );

    promptsMock
      .mockResolvedValueOnce({ apiKey: "sk-after-empty-file" })
      .mockResolvedValueOnce({ verify: false });

    const result = await configureProviderCredentials("openai", {
      interactive: true,
      persist: false,
      processEnvOnly: true,
      projectDir,
      required: false,
    });

    expect(promptsMock).toHaveBeenCalled();
    expect(result.apiKey).toBe("sk-after-empty-file");
    expect(result.source).toBe("prompt");
  });

  it("skips prompting when an existing .env already has the provider key", async () => {
    writeFileSync(join(projectDir, ".env"), "OPENAI_API_KEY=sk-from-file\n");

    const result = await configureProviderCredentials("openai", {
      interactive: true,
      persist: true,
      processEnvOnly: false,
      projectDir,
      required: false,
    });

    expect(promptsMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      apiKey: "sk-from-file",
      source: "env-file",
    });
  });

  it("never prompts in non-interactive mode", async () => {
    const result = await configureProviderCredentials("openai", {
      interactive: false,
      persist: true,
      processEnvOnly: true,
      projectDir,
      required: false,
    });

    expect(promptsMock).not.toHaveBeenCalled();
    expect(result.source).toBe("none");
    expect(existsSync(join(projectDir, ".env"))).toBe(true);
    expect(getEnvFileValue(join(projectDir, ".env"), envVar)).toBeUndefined();
  });
});
