import type { Message, Metadata } from "../shared/index.js";

/**
 * Record retrieved from or persisted to a memory backend.
 */
export interface MemoryRecord {
  readonly id?: string;
  readonly content: string;
  readonly score?: number;
  readonly metadata?: Metadata;
}

/**
 * Input used to retrieve memory for a run.
 */
export interface MemoryReadContext {
  readonly runId: string;
  readonly sessionId?: string;
  readonly input: string | Message;
  readonly metadata?: Metadata;
}

/**
 * Input used to persist memory after a run.
 */
export interface MemoryWriteContext {
  readonly runId: string;
  readonly sessionId?: string;
  readonly metadata?: Metadata;
}

/**
 * Storage-independent memory integration.
 */
export interface MemoryProvider {
  read(context: MemoryReadContext): Promise<readonly MemoryRecord[]>;
  write(records: readonly MemoryRecord[], context: MemoryWriteContext): Promise<void>;
}
