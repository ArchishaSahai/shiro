import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

import {
  Agent,
  ApprovalDecisionStatus,
  ApprovalManager,
  Engine,
  LocalApprovalProvider,
  ShiroEventType,
  tool,
  type Disposable,
  type EventBus,
  type EventHandler,
  type JsonObject,
  type ShiroEvent,
  type ToolSchema,
} from "@shiro/core";
import { OpenAIPlugin } from "@shiro/openai";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const apiKey = process.env.OPENAI_API_KEY;

if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error("OPENAI_API_KEY is required to run the basic agent example.");
}

class ConsoleEventBus implements EventBus {
  async publish(event: ShiroEvent): Promise<void> {
    await Promise.resolve();

    if (event.type === ShiroEventType.AgentHandoffCompleted) {
      console.log(`handoff: ${event.fromAgent} -> ${event.toAgent}`);
    }

    if (event.type === ShiroEventType.ToolCompleted) {
      console.log(`tool: ${event.result.name}`);
    }

    if (event.type === ShiroEventType.ApprovalRequested) {
      console.log(`approval requested: ${event.toolCall.name}`);
    }

    if (event.type === ShiroEventType.ApprovalGranted) {
      console.log(`approval granted: ${event.toolCall.name}`);
    }
  }

  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable {
    void type;
    void handler;

    return Object.freeze({
      dispose(): void {
        void type;
      },
    });
  }
}

const engine = new Engine({
  approvalManager: new ApprovalManager({
    provider: new LocalApprovalProvider(ApprovalDecisionStatus.Granted),
  }),
  events: new ConsoleEventBus(),
});

engine.use(
  new OpenAIPlugin({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  })
);

interface SensitiveInput extends JsonObject {
  readonly action: string;
}

const sensitiveSchema: ToolSchema<SensitiveInput> = {
  parse(input: unknown): SensitiveInput {
    if (!isObject(input) || typeof input.action !== "string") {
      throw new Error("action is required.");
    }

    return Object.freeze({
      action: input.action,
    });
  },
  toJSONSchema(): JsonObject {
    return Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({
        action: Object.freeze({
          description: "Sensitive action to perform after human approval.",
          type: "string",
        }),
      }),
      required: Object.freeze(["action"]),
      type: "object",
    });
  },
};

const sensitiveTool = tool({
  approvalDescription: "Approves a sensitive deployment-style operation.",
  description: "Performs a sensitive operation that requires human approval.",
  execute: async ({ action }) => {
    await Promise.resolve();
    return Object.freeze({
      action,
      status: "completed",
    });
  },
  name: "sensitive_operation",
  parameters: sensitiveSchema,
  requiresApproval: true,
});

const agent = new Agent({
  instructions:
    "You are the manager agent. Use the sensitive_operation tool when asked to perform a sensitive action, then report the result.",
  name: "Manager",
  provider: "openai",
  tools: [sensitiveTool],
});

const result = await engine.execute(
  agent,
  "Perform the sensitive action named rotate-demo-secret. Use the tool before answering.",
  { maxIterations: 6 }
);

console.log(result.output);

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
