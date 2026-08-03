import { arrow, buildTrace, cmd, md, ok, pink } from "@/lib/traces/_builder";

const response = `# Agent observability market signals

Three verified signals for the competitive brief:

1. **Runtime-first DX** — tools that treat traces as the primary surface are winning adoption
2. **Terminal as control plane** — CLI-native workflows outperform dashboard-only products
3. **Live multi-panel sync** — teams expect timeline, graph, and tools to update mid-run

## Evidence table

| Source | Signal | Confidence |
| --- | --- | --- |
| Web research | 8 sources reviewed | High |
| Vendor blogs | Runtime UX emphasis | Medium |
| Community threads | CLI preference | High |

\`\`\`ts
const brief = await research.summarize({
  query: "agent observability",
  sources: 8,
});
\`\`\`

> Compacted older session turns before drafting the final summary.
`;

export const researchTrace = buildTrace({
  id: "research",
  title: "Research Lead",
  description: "Gather market evidence and produce a competitive summary.",
  command: "shiro run research-agent",
  aliases: ["research-agent", "examples/research", "traces/research"],
  agentName: "Research Lead",
  sessionId: "session_research",
  provider: "gemini",
  model: "gemini-2.5-pro",
  runId: "run_market_research_19aa",
  events: [
    cmd(0, "$ shiro run research-agent"),
    ok(120, "✓ Engine started", "engine.started", {
      agentName: "Research Lead",
      model: "gemini-2.5-pro",
      provider: "gemini",
      sessionId: "session_research",
    }),
    arrow(300, "→ Loading providers...", "provider.loading"),
    ok(520, "✓ Gemini connected", "provider.connected", {
      model: "gemini-2.5-pro",
      provider: "gemini",
    }),
    arrow(680, "→ Creating runner...", "runner.creating"),
    arrow(820, "→ Memory retrieve prior briefs", "memory.retrieved", {
      kind: "retrieved",
      recordCount: 6,
      sessionId: "session_research",
    }),
    arrow(980, "→ Calling research agent...", "agent.calling", { agentName: "Research Lead" }),
    arrow(1120, "→ Provider call gemini-2.5-pro", "provider.call.started", {
      model: "gemini-2.5-pro",
      provider: "gemini",
      spanId: "provider:0",
    }),
    ok(1580, "✓ Provider responded (460ms)", "provider.call.completed", {
      durationMs: 460,
      finishReason: "tool_calls",
      inputTokens: 900,
      latencyMs: 460,
      outputTokens: 80,
      spanId: "provider:0",
      totalTokens: 980,
    }),
    arrow(1720, "→ Tool web-research()", "tool.started", {
      arguments: { query: "agent observability" },
      spanId: "tool:web-research",
      toolName: "web-research",
    }),
    ok(2280, "✓ 8 sources collected", "tool.completed", {
      durationMs: 560,
      result: { sources: 8 },
      spanId: "tool:web-research",
      status: "completed",
      toolName: "web-research",
    }),
    pink(2440, "→ Handoff → market analyst", "handoff.started", {
      destinationAgent: "Market Analyst",
      reason: "Gather market evidence.",
      sourceAgent: "Research Lead",
      spanId: "handoff:Research Lead:Market Analyst",
    }),
    pink(2680, "✓ Handoff complete", "handoff.completed", {
      destinationAgent: "Market Analyst",
      durationMs: 240,
      reason: "Gather market evidence.",
      sourceAgent: "Research Lead",
      spanId: "handoff:Research Lead:Market Analyst",
    }),
    arrow(2840, "→ Memory compact session", "memory.compacted", {
      kind: "compacted",
      messageCount: 22,
      sessionId: "session_research",
    }),
    arrow(3000, "→ Provider call gemini-2.5-pro", "provider.call.started", {
      model: "gemini-2.5-pro",
      provider: "gemini",
      spanId: "provider:1",
    }),
    ok(3520, "✓ Brief drafted", "provider.call.completed", {
      durationMs: 520,
      estimatedCost: 0.014,
      finishReason: "completed",
      inputTokens: 1500,
      latencyMs: 520,
      outputTokens: 410,
      spanId: "provider:1",
      totalTokens: 1910,
    }),
    md(3660, response),
    ok(3780, "✓ Run completed (2.0s)", "run.completed", {
      estimatedCost: 0.014,
      finalOutput: response,
      finalStatus: "completed",
      markdown: response,
      totalTokens: 2890,
    }),
  ],
});
