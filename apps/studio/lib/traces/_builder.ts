import type {
  MockTraceDefinition,
  StudioEventPayload,
  StudioEventType,
  StudioRuntimeEvent,
  TerminalLineKind,
} from "@/lib/runtime-events";

interface EventDraft {
  readonly type: StudioEventType;
  readonly offsetMs: number;
  readonly message?: string;
  readonly terminalKind?: TerminalLineKind;
  readonly payload?: StudioEventPayload;
}

export function buildTrace(input: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly command: string;
  readonly aliases: readonly string[];
  readonly agentName: string;
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly runId: string;
  readonly events: readonly EventDraft[];
}): MockTraceDefinition {
  return {
    aliases: input.aliases,
    agentName: input.agentName,
    command: input.command,
    description: input.description,
    events: input.events.map((event, index) => toRuntimeEvent(input.runId, event, index)),
    id: input.id,
    model: input.model,
    provider: input.provider,
    sessionId: input.sessionId,
    title: input.title,
  };
}

export function cmd(offsetMs: number, message: string): EventDraft {
  return { message, offsetMs, terminalKind: "command", type: "run.started" };
}

export function ok(
  offsetMs: number,
  message: string,
  type: StudioEventType = "engine.started",
  payload?: StudioEventPayload
): EventDraft {
  return payload === undefined
    ? { message, offsetMs, terminalKind: "success", type }
    : { message, offsetMs, payload, terminalKind: "success", type };
}

export function arrow(
  offsetMs: number,
  message: string,
  type: StudioEventType,
  payload?: StudioEventPayload
): EventDraft {
  return payload === undefined
    ? { message, offsetMs, terminalKind: "event", type }
    : { message, offsetMs, payload, terminalKind: "event", type };
}

export function warn(
  offsetMs: number,
  message: string,
  type: StudioEventType,
  payload?: StudioEventPayload
): EventDraft {
  return payload === undefined
    ? { message, offsetMs, terminalKind: "warning", type }
    : { message, offsetMs, payload, terminalKind: "warning", type };
}

export function pink(
  offsetMs: number,
  message: string,
  type: StudioEventType,
  payload?: StudioEventPayload
): EventDraft {
  return payload === undefined
    ? { message, offsetMs, terminalKind: "pink", type }
    : { message, offsetMs, payload, terminalKind: "pink", type };
}

export function md(
  offsetMs: number,
  markdown: string,
  type: StudioEventType = "response.completed"
): EventDraft {
  return {
    message: "Assistant response",
    offsetMs,
    payload: { finalOutput: markdown, markdown },
    terminalKind: "markdown",
    type,
  };
}

function toRuntimeEvent(runId: string, event: EventDraft, index: number): StudioRuntimeEvent {
  const result: {
    id: string;
    type: StudioEventType;
    offsetMs: number;
    runId: string;
    message?: string;
    terminalKind?: TerminalLineKind;
    payload?: StudioEventPayload;
  } = {
    id: `${runId}_${event.type}_${String(index)}`,
    offsetMs: event.offsetMs,
    runId,
    type: event.type,
  };

  if (event.message !== undefined) {
    result.message = event.message;
  }
  if (event.terminalKind !== undefined) {
    result.terminalKind = event.terminalKind;
  }
  if (event.payload !== undefined) {
    result.payload = event.payload;
  }

  return result;
}
