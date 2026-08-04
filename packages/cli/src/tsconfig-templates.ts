import { writeFileSync } from "node:fs";

/**
 * Agent project tsconfig written by `shiro init`.
 * Must be fully self-contained — never extend monorepo `tsconfig.base.json`.
 */
export function agentTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      esModuleInterop: true,
      exactOptionalPropertyTypes: true,
      isolatedModules: true,
      lib: ["ES2023"],
      module: "NodeNext",
      moduleDetection: "force",
      moduleResolution: "NodeNext",
      noEmit: true,
      noUncheckedIndexedAccess: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2023",
    },
    include: ["src", "shiro.config.ts"],
  };
}

export function agentTsconfigTemplate(): string {
  return `${JSON.stringify(agentTsconfig(), null, 2)}\n`;
}

/**
 * Studio app tsconfig for published / vendored consumer installs.
 * Must not extend monorepo-only configs (`tsconfig.base.json`).
 */
export function standaloneStudioTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      allowJs: true,
      allowSyntheticDefaultImports: true,
      baseUrl: ".",
      composite: false,
      declaration: false,
      declarationMap: false,
      esModuleInterop: true,
      exactOptionalPropertyTypes: true,
      forceConsistentCasingInFileNames: true,
      incremental: true,
      isolatedModules: true,
      jsx: "preserve",
      lib: ["DOM", "DOM.Iterable", "ES2023"],
      module: "ESNext",
      moduleDetection: "force",
      moduleResolution: "Bundler",
      noEmit: true,
      noFallthroughCasesInSwitch: true,
      noImplicitAny: true,
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      paths: { "@/*": ["./*"] },
      plugins: [{ name: "next" }],
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2023",
      verbatimModuleSyntax: true,
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", "*.mjs", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
}

export function writeStandaloneStudioTsconfig(filePath: string): void {
  writeFileSync(filePath, `${JSON.stringify(standaloneStudioTsconfig(), null, 2)}\n`, "utf8");
}

/** True when a tsconfig JSON string does not extend a monorepo (or any) base file. */
export function isSelfContainedTsconfig(raw: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }
  if (!("compilerOptions" in parsed)) {
    return false;
  }
  if ("extends" in parsed && (parsed as { extends?: unknown }).extends !== undefined) {
    return false;
  }
  return !raw.includes("tsconfig.base.json");
}
