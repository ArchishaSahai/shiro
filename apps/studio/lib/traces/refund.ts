import { arrow, buildTrace, cmd, md, ok, pink, warn } from "@/lib/traces/_builder";

const response = `# Refund decision

Customer **acct_48** requested a refund for order \`ord_7741\`.

## Findings

| Check | Result |
| --- | --- |
| Order age | 11 days |
| Policy window | 14 days |
| Chargeback risk | Low |

### Decision

Refund **approved** for \`$64.00\` after policy validation.

\`\`\`bash
shiro run refund-agent --order ord_7741
\`\`\`

> Human approval was required because \`issueRefund\` is marked destructive.

- [x] Order verified
- [x] Policy matched
- [x] Refund issued
`;

export const refundTrace = buildTrace({
  id: "refund",
  title: "Refund Agent",
  description: "Validate refund eligibility, request approval, and issue a refund.",
  command: "shiro run refund-agent",
  aliases: ["refund-agent", "examples/refund", "traces/customer-refund", "traces/refund"],
  agentName: "Refund Agent",
  sessionId: "session_refund_441",
  provider: "anthropic",
  model: "claude-4.1-sonnet",
  runId: "run_refund_c441",
  events: [
    cmd(0, "$ shiro replay traces/customer-refund"),
    ok(160, "✓ Engine started", "engine.started", {
      agentName: "Refund Agent",
      model: "claude-4.1-sonnet",
      provider: "anthropic",
      sessionId: "session_refund_441",
    }),
    arrow(380, "→ Loading providers...", "provider.loading", { provider: "anthropic" }),
    ok(640, "✓ Anthropic connected", "provider.connected", {
      model: "claude-4.1-sonnet",
      provider: "anthropic",
    }),
    arrow(820, "→ Creating runner...", "runner.creating"),
    arrow(980, "→ Calling refund agent...", "agent.calling", { agentName: "Refund Agent" }),
    arrow(1120, "→ Provider call claude-4.1-sonnet", "provider.call.started", {
      model: "claude-4.1-sonnet",
      provider: "anthropic",
      spanId: "provider:0",
    }),
    ok(1680, "✓ Provider responded (560ms)", "provider.call.completed", {
      durationMs: 560,
      finishReason: "tool_calls",
      inputTokens: 720,
      latencyMs: 560,
      outputTokens: 90,
      spanId: "provider:0",
      totalTokens: 810,
    }),
    arrow(1820, "→ Tool lookupOrder()", "tool.started", {
      arguments: { orderId: "ord_7741" },
      spanId: "tool:lookupOrder",
      toolName: "lookupOrder",
    }),
    ok(2140, "✓ order found", "tool.completed", {
      durationMs: 320,
      result: { ageDays: 11, amount: 64, status: "delivered" },
      spanId: "tool:lookupOrder",
      status: "completed",
      toolName: "lookupOrder",
    }),
    arrow(2280, "→ Tool checkRefundPolicy()", "tool.started", {
      arguments: { ageDays: 11 },
      spanId: "tool:checkRefundPolicy",
      toolName: "checkRefundPolicy",
    }),
    ok(2520, "✓ within 14-day window", "tool.completed", {
      durationMs: 240,
      result: { allowed: true, windowDays: 14 },
      spanId: "tool:checkRefundPolicy",
      status: "completed",
      toolName: "checkRefundPolicy",
    }),
    warn(2680, "→ Approval requested for issueRefund", "approval.requested", {
      policy: "destructive-action",
      spanId: "approval:issueRefund",
      toolName: "issueRefund",
    }),
    ok(3180, "✓ Approved by Nora Patel", "approval.granted", {
      approver: "Nora Patel",
      decision: "approval.granted",
      durationMs: 500,
      policy: "destructive-action",
      spanId: "approval:issueRefund",
      toolName: "issueRefund",
    }),
    arrow(3320, "→ Tool issueRefund()", "tool.started", {
      arguments: { amount: 64, orderId: "ord_7741" },
      spanId: "tool:issueRefund",
      toolName: "issueRefund",
    }),
    ok(3760, "✓ refund issued", "tool.completed", {
      durationMs: 440,
      result: { refundId: "rfnd_992", status: "succeeded" },
      spanId: "tool:issueRefund",
      status: "completed",
      toolName: "issueRefund",
    }),
    pink(3900, "→ Handoff → support", "handoff.started", {
      destinationAgent: "Support Triage",
      reason: "Notify customer of refund.",
      sourceAgent: "Refund Agent",
      spanId: "handoff:Refund Agent:Support Triage",
    }),
    pink(4120, "✓ Handoff complete", "handoff.completed", {
      destinationAgent: "Support Triage",
      durationMs: 220,
      reason: "Notify customer of refund.",
      sourceAgent: "Refund Agent",
      spanId: "handoff:Refund Agent:Support Triage",
    }),
    arrow(4280, "→ Provider call claude-4.1-sonnet", "provider.call.started", {
      model: "claude-4.1-sonnet",
      provider: "anthropic",
      spanId: "provider:1",
    }),
    ok(4780, "✓ Response generated", "provider.call.completed", {
      durationMs: 500,
      estimatedCost: 0.022,
      finishReason: "completed",
      inputTokens: 980,
      latencyMs: 500,
      outputTokens: 280,
      spanId: "provider:1",
      totalTokens: 1260,
    }),
    arrow(4900, "→ Memory store refund decision", "memory.stored", {
      kind: "stored",
      recordCount: 2,
      sessionId: "session_refund_441",
    }),
    md(5040, response),
    ok(5200, "✓ Run completed (2.8s)", "run.completed", {
      estimatedCost: 0.022,
      finalOutput: response,
      finalStatus: "completed",
      markdown: response,
      totalTokens: 2070,
    }),
  ],
});
