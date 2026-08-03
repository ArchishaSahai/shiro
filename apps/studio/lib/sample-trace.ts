import type {
  StudioJsonValue,
  StudioRunTrace,
  StudioTraceSnapshot,
  StudioTraceStatus,
} from "@/lib/trace-utils";

const base = Date.parse("2026-08-03T09:15:00.000Z");

export const sampleTrace: StudioTraceSnapshot = Object.freeze({
  createdAt: new Date(base + 12_000),
  statistics: Object.freeze({
    averageDurationMs: 2864,
    completedRuns: 4,
    failedRuns: 1,
    totalApprovals: 4,
    totalHandoffs: 7,
    totalProviderCalls: 15,
    totalRuns: 5,
    totalToolExecutions: 9,
  }),
  traces: Object.freeze([
    createRun({
      agentName: "Operations Manager",
      approvals: [
        approval("deploy-check", 4_520, "approval.granted", "destructive-action", "Maya Chen", 320),
      ],
      durationMs: 3420,
      finalOutput:
        "Deployment risk is low. Weather dependency checked and rollout window approved.",
      handoffs: [
        handoff("Operations Manager", "Research Agent", 1_180, "Collect deployment context.", 140),
        handoff("Operations Manager", "Security Agent", 2_420, "Verify rollout safety.", 180),
      ],
      memory: [
        memory("session_loaded", 120, 0, 14, "session_prod_rollout"),
        memory("retrieved", 260, 4, 0, "session_prod_rollout"),
        memory("compacted", 2_970, 0, 22, "session_prod_rollout"),
        memory("stored", 3_310, 2, 0, "session_prod_rollout"),
      ],
      model: "gpt-5",
      provider: "openai",
      runId: "run_prod_rollout_7fc2",
      sessionId: "session_prod_rollout",
      startOffset: 0,
      status: "completed",
      tools: [
        tool(
          "weather",
          1_050,
          "completed",
          { city: "Pune" },
          { condition: "rain", risk: "medium" }
        ),
        tool(
          "deploy-check",
          2_850,
          "completed",
          { service: "api", region: "bom1" },
          { allowed: true }
        ),
      ],
    }),
    createRun({
      agentName: "Support Triage",
      approvals: [],
      durationMs: 2180,
      finalOutput:
        "Issue classified as billing. Customer should receive the invoice reconciliation macro.",
      handoffs: [
        handoff("Support Triage", "Billing Agent", 1_120, "Invoice context required.", 110),
      ],
      memory: [
        memory("session_loaded", 80, 0, 8, "session_support_182"),
        memory("retrieved", 180, 3, 0, "session_support_182"),
        memory("stored", 2_090, 1, 0, "session_support_182"),
      ],
      model: "claude-4.1-sonnet",
      provider: "anthropic",
      runId: "run_support_triage_a91e",
      sessionId: "session_support_182",
      startOffset: 8_000,
      status: "completed",
      tools: [
        tool("customer-lookup", 720, "completed", { accountId: "acct_48" }, { plan: "pro" }),
        tool("invoice-search", 1_300, "completed", { invoice: "INV-8821" }, { status: "open" }),
      ],
    }),
    createRun({
      agentName: "Security Analyst",
      approvals: [
        approval(
          "revoke-token",
          2_010,
          "approval.rejected",
          "destructive-action",
          "Nora Patel",
          410
        ),
      ],
      durationMs: 4910,
      finalOutput:
        "Token revocation was rejected. Incident remains open pending owner confirmation.",
      handoffs: [],
      memory: [
        memory("session_loaded", 100, 0, 11, "session_sec_incident"),
        memory("retrieved", 420, 5, 0, "session_sec_incident"),
      ],
      model: "gpt-5",
      provider: "openai",
      runId: "run_security_incident_b34d",
      sessionId: "session_sec_incident",
      startOffset: 17_000,
      status: "failed",
      tools: [
        tool("audit-log-search", 1_140, "completed", { user: "usr_203" }, { suspicious: true }),
        tool("revoke-token", 2_360, "rejected", { tokenId: "tok_live_19" }, null),
      ],
    }),
    createRun({
      agentName: "Research Lead",
      approvals: [],
      durationMs: 1760,
      finalOutput: "Competitive summary prepared with three verified market signals.",
      handoffs: [handoff("Research Lead", "Market Analyst", 760, "Gather market evidence.", 90)],
      memory: [memory("retrieved", 210, 6, 0, "session_research")],
      model: "gemini-2.5-pro",
      provider: "gemini",
      runId: "run_market_research_19aa",
      sessionId: "session_research",
      startOffset: 26_000,
      status: "completed",
      tools: [
        tool("web-research", 900, "completed", { query: "agent observability" }, { sources: 8 }),
      ],
    }),
    createRun({
      agentName: "Data Analyst",
      approvals: [
        approval("warehouse-query", 1_680, "approval.granted", "external-data", "Ari Singh", 260),
        approval("export-csv", 2_320, "approval.granted", "data-export", "Ari Singh", 190),
      ],
      durationMs: 2050,
      finalOutput: "Weekly usage report generated and export approved.",
      handoffs: [
        handoff("Data Analyst", "Reporting Agent", 1_420, "Prepare stakeholder summary.", 130),
        handoff("Reporting Agent", "Data Analyst", 1_780, "Return summarized metrics.", 120),
      ],
      memory: [
        memory("session_loaded", 90, 0, 16, "session_usage_report"),
        memory("stored", 1_960, 3, 0, "session_usage_report"),
      ],
      model: "llama-3.3-70b",
      provider: "groq",
      runId: "run_usage_report_d008",
      sessionId: "session_usage_report",
      startOffset: 34_000,
      status: "completed",
      tools: [
        tool("warehouse-query", 980, "completed", { table: "usage_daily" }, { rows: 320 }),
        tool("export-csv", 1_740, "completed", { format: "csv" }, { file: "usage.csv" }),
      ],
    }),
  ]),
});

interface RunInput {
  readonly agentName: string;
  readonly approvals: readonly StudioRunTrace["approvals"][number][];
  readonly durationMs: number;
  readonly finalOutput: string;
  readonly handoffs: readonly StudioRunTrace["handoffs"][number][];
  readonly memory: readonly StudioRunTrace["memory"][number][];
  readonly model: string;
  readonly provider: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly startOffset: number;
  readonly status: StudioTraceStatus;
  readonly tools: readonly StudioRunTrace["toolExecutions"][number][];
}

function createRun(input: RunInput): StudioRunTrace {
  const start = base + input.startOffset;
  const modelCalls = [0, 1, 2].map((index) =>
    Object.freeze({
      finishReason: index === 2 ? "completed" : index === 1 ? "tool_calls" : "continue",
      latencyMs: Math.round(input.durationMs / 5 + index * 140),
      model: input.model,
      providerName: input.provider,
      requestTimestamp: new Date(start + 280 + index * 740),
      responseTimestamp: new Date(start + 720 + index * 740),
      retryNumber: index === 2 && input.status === "failed" ? 1 : 0,
      tokenUsage: Object.freeze({
        inputTokens: 520 + index * 180,
        outputTokens: 110 + index * 70,
        totalTokens: 630 + index * 250,
      }),
    })
  );

  return Object.freeze({
    agentName: input.agentName,
    approvals: Object.freeze(input.approvals),
    endTime: new Date(start + input.durationMs),
    finalOutput: input.finalOutput,
    finalStatus: input.status,
    handoffs: Object.freeze(input.handoffs),
    memory: Object.freeze(input.memory),
    model: input.model,
    modelCalls: Object.freeze(modelCalls),
    provider: input.provider,
    runId: input.runId,
    sessionId: input.sessionId,
    startTime: new Date(start),
    timeline: Object.freeze({
      events: Object.freeze([
        event(input.runId, "run.started", start),
        event(input.runId, "memory.retrieve", start + 120),
        event(input.runId, "provider.call", start + 280),
        ...(input.status === "failed" ? [event(input.runId, "provider.retry", start + 760)] : []),
        ...input.tools.map((entry) =>
          event(input.runId, `tool.${entry.status}`, start + (entry.durationMs ?? 0))
        ),
        ...input.tools.map((entry) =>
          event(input.runId, "tool.completed", start + (entry.durationMs ?? 0) + 120)
        ),
        ...input.handoffs.map((entry) =>
          event(input.runId, "handoff.started", entry.timestamp.getTime() - 40)
        ),
        ...input.handoffs.map((entry) =>
          event(input.runId, "handoff.completed", entry.timestamp.getTime())
        ),
        ...input.approvals.map((entry) =>
          event(input.runId, "approval.requested", entry.timestamp.getTime() - 80)
        ),
        ...input.approvals.map((entry) =>
          event(input.runId, entry.decision ?? "approval.pending", entry.timestamp.getTime())
        ),
        event(input.runId, "provider.call", start + input.durationMs - 620),
        event(input.runId, "response.streaming", start + input.durationMs - 360),
        event(
          input.runId,
          input.status === "failed" ? "run.failed" : "run.completed",
          start + input.durationMs
        ),
      ]),
      spans: Object.freeze([
        span(
          "Provider orchestration",
          "provider",
          Math.round(input.durationMs * 0.36),
          start + 280,
          input.status
        ),
        ...input.tools.map((entry) =>
          span(
            entry.toolName,
            "tool",
            entry.durationMs ?? 0,
            start + (entry.durationMs ?? 0),
            entry.status
          )
        ),
        ...input.handoffs.map((entry) =>
          span(
            "Agent handoff",
            "handoff",
            entry.durationMs ?? 0,
            entry.timestamp.getTime(),
            "completed"
          )
        ),
        ...input.approvals.map((entry) =>
          span(
            "Approval gate",
            "approval",
            entry.durationMs ?? 0,
            entry.timestamp.getTime(),
            "completed"
          )
        ),
        ...input.memory.map((entry) =>
          span(entry.kind, "memory", 60, entry.timestamp.getTime(), "completed")
        ),
      ]),
    }),
    tokenUsage: Object.freeze({
      estimatedCost: Number((input.durationMs / 100000).toFixed(4)),
      inputTokens: 2100,
      outputTokens: 540,
      totalTokens: 2640,
    }),
    toolExecutions: Object.freeze(input.tools),
    totalDurationMs: input.durationMs,
    totalIterations: 2 + input.tools.length,
  });
}

function event(runId: string, type: string, timestamp: number) {
  return Object.freeze({
    eventId: `${runId}_${type}_${String(timestamp)}`,
    runId,
    timestamp: new Date(timestamp),
    type,
  });
}

function span(name: string, category: string, durationMs: number, start: number, status: string) {
  return Object.freeze({
    category,
    durationMs,
    endTime: new Date(start + durationMs),
    name,
    spanId: `${name}_${String(start)}`.toLowerCase().replaceAll(" ", "_"),
    startTime: new Date(start),
    status,
  });
}

function tool(
  toolName: string,
  durationMs: number,
  status: string,
  args: Readonly<Record<string, StudioJsonValue>>,
  result: StudioJsonValue
) {
  return Object.freeze({ arguments: args, durationMs, serializedResult: result, status, toolName });
}

function handoff(
  sourceAgent: string,
  destinationAgent: string,
  offset: number,
  reason: string,
  durationMs: number
) {
  return Object.freeze({
    destinationAgent,
    durationMs,
    reason,
    sourceAgent,
    timestamp: new Date(base + offset),
  });
}

function approval(
  toolName: string,
  offset: number,
  decision: string,
  policy: string,
  approver: string,
  durationMs: number
) {
  return Object.freeze({
    approver,
    decision,
    durationMs,
    policy,
    timestamp: new Date(base + offset),
    toolName,
  });
}

function memory(
  kind: string,
  offset: number,
  recordCount: number,
  messageCount: number,
  sessionId: string
) {
  return Object.freeze({
    kind,
    messageCount,
    recordCount,
    sessionId,
    timestamp: new Date(base + offset),
  });
}
