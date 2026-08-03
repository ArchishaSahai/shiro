import { arrow, buildTrace, cmd, md, ok, pink, warn } from "@/lib/traces/_builder";

const response = `# Invoice reconciliation complete

I looked up **INV-8821** for account \`acct_48\` and confirmed the open balance.

## Summary

| Field | Value |
| --- | --- |
| Invoice | INV-8821 |
| Status | Open |
| Plan | Pro |
| Amount due | $128.40 |

## Recommended next steps

1. Send the **billing reconciliation** macro to the customer
2. Offer a one-click payment link for the outstanding balance
3. Escalate to billing only if the charge is disputed

> The handoff to **Billing** was approved after \`lookupInvoice()\` returned a match.

\`\`\`ts
await billing.sendMacro({
  template: "invoice-reconciliation",
  invoiceId: "INV-8821",
});
\`\`\`

- [x] Invoice found
- [x] Handoff approved
- [ ] Payment confirmed
`;

export const customerSupportTrace = buildTrace({
  id: "customer-support",
  title: "Customer Support",
  description: "Triage a billing invoice inquiry with tool use, handoff, and approval.",
  command: "shiro run support-agent",
  aliases: ["support-agent", "examples/customer-support", "traces/customer-support"],
  agentName: "Support Triage",
  sessionId: "session_support_182",
  provider: "openai",
  model: "gpt-5",
  runId: "run_support_triage_a91e",
  events: [
    cmd(0, "$ shiro run support-agent"),
    ok(180, "✓ Engine started", "engine.started", {
      agentName: "Support Triage",
      model: "gpt-5",
      provider: "openai",
      sessionId: "session_support_182",
    }),
    arrow(420, "→ Loading providers...", "provider.loading", { provider: "openai" }),
    ok(780, "✓ OpenAI connected", "provider.connected", {
      model: "gpt-5",
      provider: "openai",
    }),
    arrow(980, "→ Creating runner...", "runner.creating"),
    arrow(1180, "→ Loading session memory...", "memory.session_loaded", {
      kind: "session_loaded",
      messageCount: 8,
      sessionId: "session_support_182",
    }),
    arrow(1380, "→ Calling support agent...", "agent.calling", {
      agentName: "Support Triage",
    }),
    arrow(1520, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:0",
    }),
    ok(1980, "✓ Provider responded (460ms)", "provider.call.completed", {
      durationMs: 460,
      finishReason: "tool_calls",
      inputTokens: 840,
      latencyMs: 460,
      model: "gpt-5",
      outputTokens: 120,
      provider: "openai",
      spanId: "provider:0",
      totalTokens: 960,
    }),
    arrow(2100, "→ Tool lookupInvoice()", "tool.started", {
      arguments: { invoice: "INV-8821" },
      spanId: "tool:lookupInvoice",
      toolName: "lookupInvoice",
    }),
    ok(2480, "✓ invoice found", "tool.completed", {
      durationMs: 380,
      result: { amountDue: 128.4, status: "open" },
      spanId: "tool:lookupInvoice",
      status: "completed",
      toolName: "lookupInvoice",
    }),
    arrow(2600, "→ Memory retrieve customer context", "memory.retrieved", {
      kind: "retrieved",
      recordCount: 3,
      sessionId: "session_support_182",
    }),
    pink(2780, "→ Handoff → billing", "handoff.started", {
      destinationAgent: "Billing Agent",
      reason: "Invoice context required.",
      sourceAgent: "Support Triage",
      spanId: "handoff:Support Triage:Billing Agent",
    }),
    warn(2980, "→ Approval requested", "approval.requested", {
      policy: "billing-handoff",
      spanId: "approval:handoff-billing",
      toolName: "handoff-billing",
    }),
    ok(3340, "✓ Approved", "approval.granted", {
      approver: "Maya Chen",
      decision: "approval.granted",
      durationMs: 360,
      policy: "billing-handoff",
      spanId: "approval:handoff-billing",
      toolName: "handoff-billing",
    }),
    pink(3480, "✓ Handoff complete", "handoff.completed", {
      destinationAgent: "Billing Agent",
      durationMs: 700,
      reason: "Invoice context required.",
      sourceAgent: "Support Triage",
      spanId: "handoff:Support Triage:Billing Agent",
    }),
    arrow(3620, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:1",
    }),
    ok(4100, "✓ Response tokens streamed", "provider.call.completed", {
      durationMs: 480,
      estimatedCost: 0.018,
      finishReason: "completed",
      inputTokens: 1120,
      latencyMs: 480,
      outputTokens: 340,
      spanId: "provider:1",
      totalTokens: 1460,
    }),
    arrow(4220, "→ Response generated", "response.streaming"),
    arrow(4340, "→ Storing turn in memory", "memory.stored", {
      kind: "stored",
      recordCount: 1,
      sessionId: "session_support_182",
    }),
    md(4480, response),
    ok(4600, "✓ Run completed (2.4s)", "run.completed", {
      estimatedCost: 0.018,
      finalOutput: response,
      finalStatus: "completed",
      inputTokens: 1960,
      markdown: response,
      outputTokens: 460,
      totalTokens: 2420,
    }),
  ],
});
