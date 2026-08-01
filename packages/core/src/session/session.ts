import type { Message, Metadata } from "../shared/index.js";

/**
 * Execution statistics persisted with a session.
 */
export interface SessionExecutionStats {
  readonly runCount: number;
  readonly messageCount: number;
}

/**
 * Conversation state persisted separately from Agent configuration.
 */
export interface ConversationState {
  readonly messages: readonly Message[];
  readonly activeAgent?: string;
  readonly stats: SessionExecutionStats;
}

/**
 * Serialized session state.
 */
export interface SessionSnapshot {
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly conversation: ConversationState;
  readonly messages: readonly Message[];
  readonly activeAgent?: string;
  readonly metadata?: Metadata;
}

/**
 * Conversation boundary for one user or workflow.
 */
export interface Session extends SessionSnapshot {}

/**
 * Persistence abstraction for sessions.
 */
export interface SessionStore {
  get(id: string): Promise<SessionSnapshot | null>;
  save(session: SessionSnapshot): Promise<void>;
  delete(id: string): Promise<void>;
  list?(): Promise<readonly SessionSnapshot[]>;
}

/**
 * In-memory session store for development and tests.
 */
export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<string, SessionSnapshot>();

  async get(id: string): Promise<SessionSnapshot | null> {
    await Promise.resolve();
    return this.#sessions.get(id) ?? null;
  }

  async save(session: SessionSnapshot): Promise<void> {
    await Promise.resolve();
    this.#sessions.set(session.sessionId, freezeSession(session));
  }

  async delete(id: string): Promise<void> {
    await Promise.resolve();
    this.#sessions.delete(id);
  }

  async list(): Promise<readonly SessionSnapshot[]> {
    await Promise.resolve();
    return Object.freeze([...this.#sessions.values()]);
  }
}

/**
 * Coordinates session lifecycle without coupling storage to Runner.
 */
export class SessionManager {
  readonly #store: SessionStore;

  constructor(store: SessionStore = new InMemorySessionStore()) {
    this.#store = store;
  }

  /** Creates a new session. */
  async createSession(metadata?: Metadata): Promise<Session> {
    const now = new Date();
    const sessionId = createSessionId();
    const snapshot: Partial<MutableSessionSnapshot> = {
      conversation: freezeConversation([]),
      createdAt: now,
      id: sessionId,
      messages: Object.freeze([]),
      sessionId,
      updatedAt: now,
    };

    if (metadata !== undefined) {
      snapshot.metadata = Object.freeze({ ...metadata });
    }

    const session = freezeSession(snapshot as SessionSnapshot);
    await this.#store.save(session);
    return session;
  }

  /** Loads a session by id. */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.#store.get(sessionId);
  }

  /** Updates or creates a session snapshot. */
  async updateSession(session: SessionSnapshot): Promise<Session> {
    const snapshot = freezeSession(session);
    await this.#store.save(snapshot);
    return snapshot;
  }

  /** Deletes a session. */
  async deleteSession(sessionId: string): Promise<void> {
    await this.#store.delete(sessionId);
  }

  /** Lists sessions when supported by the backing store. */
  async listSessions(): Promise<readonly Session[]> {
    return this.#store.list?.() ?? Object.freeze([]);
  }
}

/**
 * Creates an updated session from existing messages.
 */
export function createSessionSnapshot(
  sessionId: string,
  messages: readonly Message[],
  activeAgent: string | undefined,
  previous: SessionSnapshot | null,
  metadata: Metadata | undefined
): SessionSnapshot {
  const now = new Date();
  const createdAt = previous?.createdAt ?? now;
  const runCount = (previous?.conversation.stats.runCount ?? 0) + 1;
  const conversation = freezeConversation(messages, activeAgent, {
    messageCount: messages.length,
    runCount,
  });
  const snapshot: Partial<MutableSessionSnapshot> = {
    conversation,
    createdAt,
    id: sessionId,
    messages: conversation.messages,
    sessionId,
    updatedAt: now,
  };

  if (activeAgent !== undefined) {
    snapshot.activeAgent = activeAgent;
  }

  if (metadata !== undefined) {
    snapshot.metadata = Object.freeze({ ...metadata });
  }

  return freezeSession(snapshot as SessionSnapshot);
}

type MutableSessionSnapshot = {
  -readonly [Key in keyof SessionSnapshot]: SessionSnapshot[Key];
};

function freezeSession(session: SessionSnapshot): Session {
  const snapshot: Partial<MutableSessionSnapshot> = {
    conversation: freezeConversation(
      session.conversation.messages,
      session.conversation.activeAgent,
      session.conversation.stats
    ),
    createdAt: session.createdAt,
    id: session.id,
    messages: Object.freeze([...session.messages]),
    sessionId: session.sessionId,
    updatedAt: session.updatedAt,
  };

  if (session.activeAgent !== undefined) {
    snapshot.activeAgent = session.activeAgent;
  }

  if (session.metadata !== undefined) {
    snapshot.metadata = Object.freeze({ ...session.metadata });
  }

  return Object.freeze(snapshot) as Session;
}

function freezeConversation(
  messages: readonly Message[],
  activeAgent?: string,
  stats: SessionExecutionStats = { messageCount: messages.length, runCount: 0 }
): ConversationState {
  const state: Partial<MutableConversationState> = {
    messages: Object.freeze([...messages]),
    stats: Object.freeze({ ...stats }),
  };

  if (activeAgent !== undefined) {
    state.activeAgent = activeAgent;
  }

  return Object.freeze(state) as ConversationState;
}

type MutableConversationState = {
  -readonly [Key in keyof ConversationState]: ConversationState[Key];
};

function createSessionId(): string {
  return `session_${crypto.randomUUID()}`;
}
