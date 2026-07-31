import type { Message, Metadata } from "../shared/index.js";

/**
 * Serialized session state.
 */
export interface SessionSnapshot {
  readonly id: string;
  readonly messages: readonly Message[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
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
}
