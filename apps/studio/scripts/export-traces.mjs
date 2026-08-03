import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(root, "..");
const outDir = join(studioRoot, "lib/traces/json");

// Register tsx path mapping by importing through relative paths.
const { customerSupportTrace } = await import(
  pathToFileURL(join(studioRoot, "lib/traces/customer-support.ts")).href
);
const { refundTrace } = await import(pathToFileURL(join(studioRoot, "lib/traces/refund.ts")).href);
const { travelAgentTrace } = await import(
  pathToFileURL(join(studioRoot, "lib/traces/travel-agent.ts")).href
);
const { researchTrace } = await import(
  pathToFileURL(join(studioRoot, "lib/traces/research.ts")).href
);
const { multiAgentTrace } = await import(
  pathToFileURL(join(studioRoot, "lib/traces/multi-agent.ts")).href
);

mkdirSync(outDir, { recursive: true });

const traces = [
  customerSupportTrace,
  refundTrace,
  travelAgentTrace,
  researchTrace,
  multiAgentTrace,
];

for (const trace of traces) {
  const path = join(outDir, `${trace.id}.json`);
  writeFileSync(path, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  console.log(`wrote ${path}`);
}
