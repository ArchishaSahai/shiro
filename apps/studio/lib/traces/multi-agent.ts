import { arrow, buildTrace, cmd, md, ok, pink, warn } from "@/lib/traces/_builder";

const response = `# Multi-agent rollout review

**Operations Manager** coordinated research and security before approving the deploy window.

## Flow

\`\`\`
Operations Manager
  ├─ Research Agent  → context pack
  └─ Security Agent  → rollout safety
       └─ approval: deploy-check
\`\`\`

| Agent | Outcome |
| --- | --- |
| Research | Weather dependency noted |
| Security | Risk low |
| Ops | Window approved |

### Final call

Deployment risk is **low**. Weather dependency checked and rollout window approved.

- [x] Context gathered
- [x] Safety verified
- [x] Deploy check approved
`;

export const multiAgentTrace = buildTrace({
  id: "multi-agent",
  title: "Multi-Agent Ops",
  description: "Operations manager orchestrates research, security, and deploy approval.",
  command: "shiro run multi-agent",
  aliases: ["multi-agent", "examples/multi-agent", "traces/multi-agent", "ops-agent"],
  agentName: "Operations Manager",
  sessionId: "session_prod_rollout",
  provider: "openai",
  model: "gpt-5",
  runId: "run_prod_rollout_7fc2",
  events: [
    cmd(0, "$ shiro run multi-agent"),
    ok(150, "✓ Engine started", "engine.started", {
      agentName: "Operations Manager",
      model: "gpt-5",
      provider: "openai",
      sessionId: "session_prod_rollout",
    }),
    arrow(340, "→ Loading providers...", "provider.loading"),
    ok(620, "✓ OpenAI connected", "provider.connected", { provider: "openai", model: "gpt-5" }),
    arrow(780, "→ Creating runner...", "runner.creating"),
    arrow(920, "→ Memory load rollout session", "memory.session_loaded", {
      kind: "session_loaded",
      messageCount: 14,
      sessionId: "session_prod_rollout",
    }),
    arrow(1080, "→ Calling operations manager...", "agent.calling", {
      agentName: "Operations Manager",
    }),
    arrow(1240, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:0",
    }),
    ok(1760, "✓ Provider responded (520ms)", "provider.call.completed", {
      durationMs: 520,
      finishReason: "tool_calls",
      inputTokens: 1100,
      latencyMs: 520,
      outputTokens: 140,
      spanId: "provider:0",
      totalTokens: 1240,
    }),
    pink(1920, "→ Handoff → research", "handoff.started", {
      destinationAgent: "Research Agent",
      reason: "Collect deployment context.",
      sourceAgent: "Operations Manager",
      spanId: "handoff:Operations Manager:Research Agent",
    }),
    arrow(2100, "→ Tool weather()", "tool.started", {
      arguments: { city: "Pune" },
      spanId: "tool:weather",
      toolName: "weather",
    }),
    ok(2480, "✓ weather risk medium", "tool.completed", {
      durationMs: 380,
      result: { condition: "rain", risk: "medium" },
      spanId: "tool:weather",
      status: "completed",
      toolName: "weather",
    }),
    pink(2620, "✓ Research handoff complete", "handoff.completed", {
      destinationAgent: "Research Agent",
      durationMs: 700,
      reason: "Collect deployment context.",
      sourceAgent: "Operations Manager",
      spanId: "handoff:Operations Manager:Research Agent",
    }),
    pink(2780, "→ Handoff → security", "handoff.started", {
      destinationAgent: "Security Agent",
      reason: "Verify rollout safety.",
      sourceAgent: "Operations Manager",
      spanId: "handoff:Operations Manager:Security Agent",
    }),
    arrow(2960, "→ Tool deploy-check()", "tool.started", {
      arguments: { region: "bom1", service: "api" },
      spanId: "tool:deploy-check",
      toolName: "deploy-check",
    }),
    warn(3180, "→ Approval requested", "approval.requested", {
      policy: "destructive-action",
      spanId: "approval:deploy-check",
      toolName: "deploy-check",
    }),
    ok(3620, "✓ Approved by Maya Chen", "approval.granted", {
      approver: "Maya Chen",
      decision: "approval.granted",
      durationMs: 440,
      policy: "destructive-action",
      spanId: "approval:deploy-check",
      toolName: "deploy-check",
    }),
    ok(3840, "✓ deploy allowed", "tool.completed", {
      durationMs: 880,
      result: { allowed: true },
      spanId: "tool:deploy-check",
      status: "completed",
      toolName: "deploy-check",
    }),
    pink(3980, "✓ Security handoff complete", "handoff.completed", {
      destinationAgent: "Security Agent",
      durationMs: 1200,
      reason: "Verify rollout safety.",
      sourceAgent: "Operations Manager",
      spanId: "handoff:Operations Manager:Security Agent",
    }),
    arrow(4140, "→ Memory compact + store", "memory.compacted", {
      kind: "compacted",
      messageCount: 22,
      sessionId: "session_prod_rollout",
    }),
    arrow(4280, "→ Memory store decision", "memory.stored", {
      kind: "stored",
      recordCount: 2,
      sessionId: "session_prod_rollout",
    }),
    arrow(4440, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:1",
    }),
    ok(4980, "✓ Response generated", "provider.call.completed", {
      durationMs: 540,
      estimatedCost: 0.028,
      finishReason: "completed",
      inputTokens: 1600,
      latencyMs: 540,
      outputTokens: 360,
      spanId: "provider:1",
      totalTokens: 1960,
    }),
    md(5120, response),
    ok(5280, "✓ Run completed (3.4s)", "run.completed", {
      estimatedCost: 0.028,
      finalOutput: response,
      finalStatus: "completed",
      markdown: response,
      totalTokens: 3200,
    }),
  ],
});
