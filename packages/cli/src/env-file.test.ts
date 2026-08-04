import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectExistingCredential } from "./credentials.js";
import { getEnvFileValue, parseEnvFile, upsertEnvVar, writeEnvVar } from "./env-file.js";

describe("upsertEnvVar", () => {
  it("creates a key when the file is empty", () => {
    expect(upsertEnvVar("", "OPENAI_API_KEY", "sk-test")).toBe("OPENAI_API_KEY=sk-test\n");
  });

  it("updates an existing key without duplicating", () => {
    const input = ["# comment", "FOO=bar", "OPENAI_API_KEY=old", "BAZ=qux", ""].join("\n");
    const next = upsertEnvVar(input, "OPENAI_API_KEY", "sk-new");
    expect(next).toBe(["# comment", "FOO=bar", "OPENAI_API_KEY=sk-new", "BAZ=qux", ""].join("\n"));
    expect(next.match(/OPENAI_API_KEY=/g)?.length).toBe(1);
  });

  it("preserves DATABASE_URL, REDIS_URL, CUSTOM_ENV, comments, and blank lines", () => {
    const input = [
      "# Application secrets",
      "DATABASE_URL=postgres://localhost/app",
      "",
      "# Cache",
      "REDIS_URL=redis://localhost:6379",
      "",
      "CUSTOM_ENV=keep-me",
      "",
      "# Provider (may be empty)",
      "OPENAI_API_KEY=old-key",
      "",
      "# Trailing note",
      "",
    ].join("\n");

    const next = upsertEnvVar(input, "OPENAI_API_KEY", "sk-new");

    expect(next).toBe(
      [
        "# Application secrets",
        "DATABASE_URL=postgres://localhost/app",
        "",
        "# Cache",
        "REDIS_URL=redis://localhost:6379",
        "",
        "CUSTOM_ENV=keep-me",
        "",
        "# Provider (may be empty)",
        "OPENAI_API_KEY=sk-new",
        "",
        "# Trailing note",
        "",
      ].join("\n")
    );
    expect(next.match(/OPENAI_API_KEY=/g)?.length).toBe(1);
    expect(parseEnvFile(next)).toMatchObject({
      CUSTOM_ENV: "keep-me",
      DATABASE_URL: "postgres://localhost/app",
      OPENAI_API_KEY: "sk-new",
      REDIS_URL: "redis://localhost:6379",
    });
  });

  it("appends provider key without disturbing unrelated vars", () => {
    const input = ["DATABASE_URL=x", "", "REDIS_URL=y", "CUSTOM_ENV=z", ""].join("\n");
    const next = upsertEnvVar(input, "OPENAI_API_KEY", "sk");
    expect(next).toContain("DATABASE_URL=x");
    expect(next).toContain("REDIS_URL=y");
    expect(next).toContain("CUSTOM_ENV=z");
    expect(next.endsWith("OPENAI_API_KEY=sk\n")).toBe(true);
  });

  it("quotes values that need escaping", () => {
    const next = upsertEnvVar("", "KEY", 'hello "world"');
    expect(next).toBe('KEY="hello \\"world\\""\n');
  });
});

describe("writeEnvVar", () => {
  const filePath = resolve(process.cwd(), `.env.test-${String(process.pid)}`);

  afterEach(() => {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  });

  it("writes and updates a real file without duplicating keys", () => {
    writeEnvVar(filePath, "OPENAI_API_KEY", "first");
    writeEnvVar(filePath, "OTHER", "keep");
    writeEnvVar(filePath, "OPENAI_API_KEY", "second");
    const content = readFileSync(filePath, "utf8");
    expect(content.match(/OPENAI_API_KEY=/g)?.length).toBe(1);
    expect(getEnvFileValue(filePath, "OPENAI_API_KEY")).toBe("second");
    expect(getEnvFileValue(filePath, "OTHER")).toBe("keep");
  });
});

describe("detectExistingCredential", () => {
  const envVar = "OPENAI_API_KEY";
  const previous = process.env[envVar];
  const tempDir = resolve(process.cwd(), `.cred-test-${String(process.pid)}`);

  afterEach(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, envVar);
    } else {
      process.env[envVar] = previous;
    }
    if (existsSync(tempDir)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("prefers process environment over .env", () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(resolve(tempDir, ".env"), "OPENAI_API_KEY=from-file\n", "utf8");
    process.env[envVar] = "from-shell";
    const detected = detectExistingCredential("openai", tempDir);
    expect(detected).toEqual({ apiKey: "from-shell", source: "environment" });
  });

  it("reads from .env when process env is unset", () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(resolve(tempDir, ".env"), "OPENAI_API_KEY=from-file\n", "utf8");
    Reflect.deleteProperty(process.env, envVar);
    const detected = detectExistingCredential("openai", tempDir);
    expect(detected).toEqual({ apiKey: "from-file", source: "env-file" });
  });
});
