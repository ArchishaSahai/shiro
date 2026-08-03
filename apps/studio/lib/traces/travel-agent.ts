import { arrow, buildTrace, cmd, md, ok, pink } from "@/lib/traces/_builder";

const response = `# Tokyo itinerary (4 days)

Crafted for **late October** with rain-aware indoor backups.

## Day plan

| Day | Morning | Afternoon | Evening |
| --- | --- | --- | --- |
| 1 | Senso-ji | TeamLab Planets | Izakaya in Asakusa |
| 2 | Meiji Shrine | Harajuku walk | Shibuya skyline |
| 3 | teamLab Borderless | Shimokitazawa | Jazz bar |
| 4 | Tsukiji outer | Ginza boutiques | Departure buffer |

### Weather note

> Expect light rain on day 2 — prefer covered malls and museums.

\`\`\`json
{ "city": "Tokyo", "condition": "rain", "risk": "medium" }
\`\`\`

- [x] Flights checked
- [x] Weather retrieved
- [x] Hotels shortlisted
`;

export const travelAgentTrace = buildTrace({
  id: "travel-agent",
  title: "Travel Agent",
  description: "Plan a multi-day Tokyo trip with weather and booking tools.",
  command: "shiro run travel-agent",
  aliases: ["travel-agent", "examples/travel-agent", "traces/travel-agent"],
  agentName: "Travel Concierge",
  sessionId: "session_travel_tokyo",
  provider: "openai",
  model: "gpt-5",
  runId: "run_travel_tokyo_88",
  events: [
    cmd(0, "$ shiro run travel-agent"),
    ok(140, "✓ Engine started", "engine.started", {
      agentName: "Travel Concierge",
      model: "gpt-5",
      provider: "openai",
      sessionId: "session_travel_tokyo",
    }),
    arrow(320, "→ Loading providers...", "provider.loading"),
    ok(560, "✓ OpenAI connected", "provider.connected", { provider: "openai", model: "gpt-5" }),
    arrow(720, "→ Creating runner...", "runner.creating"),
    arrow(880, "→ Calling travel agent...", "agent.calling", { agentName: "Travel Concierge" }),
    arrow(1040, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:0",
    }),
    ok(1560, "✓ Provider responded (520ms)", "provider.call.completed", {
      durationMs: 520,
      finishReason: "tool_calls",
      inputTokens: 640,
      latencyMs: 520,
      outputTokens: 110,
      spanId: "provider:0",
      totalTokens: 750,
    }),
    arrow(1700, "→ Tool weather.lookup()", "tool.started", {
      arguments: { city: "Tokyo", dates: "2026-10-20/2026-10-24" },
      spanId: "tool:weather.lookup",
      toolName: "weather.lookup",
    }),
    ok(2080, "✓ rain expected day 2", "tool.completed", {
      durationMs: 380,
      result: { condition: "rain", risk: "medium" },
      spanId: "tool:weather.lookup",
      status: "completed",
      toolName: "weather.lookup",
    }),
    arrow(2220, "→ Tool flights.search()", "tool.started", {
      arguments: { destination: "NRT", origin: "SFO" },
      spanId: "tool:flights.search",
      toolName: "flights.search",
    }),
    ok(2740, "✓ 3 itineraries found", "tool.completed", {
      durationMs: 520,
      result: { options: 3 },
      spanId: "tool:flights.search",
      status: "completed",
      toolName: "flights.search",
    }),
    pink(2900, "→ Handoff → lodging", "handoff.started", {
      destinationAgent: "Lodging Agent",
      reason: "Shortlist hotels near Asakusa.",
      sourceAgent: "Travel Concierge",
      spanId: "handoff:Travel Concierge:Lodging Agent",
    }),
    arrow(3120, "→ Tool hotels.search()", "tool.started", {
      arguments: { area: "Asakusa", nights: 4 },
      spanId: "tool:hotels.search",
      toolName: "hotels.search",
    }),
    ok(3580, "✓ 5 hotels shortlisted", "tool.completed", {
      durationMs: 460,
      result: { count: 5 },
      spanId: "tool:hotels.search",
      status: "completed",
      toolName: "hotels.search",
    }),
    pink(3720, "✓ Handoff complete", "handoff.completed", {
      destinationAgent: "Lodging Agent",
      durationMs: 820,
      reason: "Shortlist hotels near Asakusa.",
      sourceAgent: "Travel Concierge",
      spanId: "handoff:Travel Concierge:Lodging Agent",
    }),
    arrow(3880, "→ Memory store itinerary draft", "memory.stored", {
      kind: "stored",
      recordCount: 4,
      sessionId: "session_travel_tokyo",
    }),
    arrow(4040, "→ Provider call gpt-5", "provider.call.started", {
      model: "gpt-5",
      provider: "openai",
      spanId: "provider:1",
    }),
    ok(4620, "✓ Itinerary drafted", "provider.call.completed", {
      durationMs: 580,
      estimatedCost: 0.031,
      finishReason: "completed",
      inputTokens: 1400,
      latencyMs: 580,
      outputTokens: 520,
      spanId: "provider:1",
      totalTokens: 1920,
    }),
    md(4780, response),
    ok(4920, "✓ Run completed (3.1s)", "run.completed", {
      estimatedCost: 0.031,
      finalOutput: response,
      finalStatus: "completed",
      markdown: response,
      totalTokens: 2670,
    }),
  ],
});
