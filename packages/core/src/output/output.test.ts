import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MessageRole } from "../shared/index.js";
import type {
  Provider,
  ProviderContext,
  ProviderRequest,
  ProviderResponse,
} from "../provider/index.js";
import { StructuredOutputManager } from "./output.js";

describe("StructuredOutputManager", () => {
  it("returns typed output when the provider response satisfies the schema", async () => {
    const schema = z.object({
      city: z.string(),
      temperature: z.number(),
    });

    const manager = new StructuredOutputManager();
    const result = await manager.process({
      messages: [],
      provider: new RepairingProvider(),
      providerContext: providerContext(),
      rawOutput: JSON.stringify({
        city: "Pune",
        temperature: 24,
      }),
      schema,
    });

    expect(result.output.city).toBe("Pune");
    expect(result.output.temperature).toBe(24);
    expect(result.repairAttempts).toBe(0);
  });

  it("repairs invalid output before returning", async () => {
    const schema = z.object({
      city: z.string(),
      temperature: z.number(),
      condition: z.string(),
    });
    const provider = new RepairingProvider();
    const manager = new StructuredOutputManager();

    const result = await manager.process({
      messages: [
        {
          content: "Give me structured weather.",
          role: MessageRole.User,
        },
      ],
      provider,
      providerContext: providerContext(),
      rawOutput: "Pune is warm and cloudy.",
      schema,
    });

    expect(provider.calls).toBe(1);
    expect(result.output).toEqual({
      city: "Pune",
      condition: "cloudy",
      temperature: 24,
    });
    expect(result.repairAttempts).toBe(1);
  });
});

class RepairingProvider implements Provider {
  calls = 0;
  readonly name = "repairing";

  async generate(request: ProviderRequest, context: ProviderContext): Promise<ProviderResponse> {
    await Promise.resolve();
    void request;
    void context;
    this.calls += 1;

    return Object.freeze({
      message: Object.freeze({
        content: JSON.stringify({
          city: "Pune",
          condition: "cloudy",
          temperature: 24,
        }),
        role: MessageRole.Assistant,
      }),
    });
  }
}

function providerContext(): ProviderContext {
  return Object.freeze({
    agentName: "Assistant",
    runId: "run_test",
  });
}
