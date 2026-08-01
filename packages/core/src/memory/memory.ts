import { MessageRole, type Message, type Metadata } from "../shared/index.js";

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
 * Stored memory entry.
 */
export interface MemoryEntry extends MemoryRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly embedding?: readonly number[];
}

/**
 * Snapshot of memory state.
 */
export interface MemorySnapshot {
  readonly entries: readonly MemoryEntry[];
  readonly createdAt: Date;
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
 * Query used by memory search adapters.
 */
export interface MemorySearchQuery {
  readonly query: string;
  readonly limit?: number;
  readonly metadata?: Metadata;
}

/**
 * Storage-independent memory integration.
 */
export interface MemoryProvider {
  read(context: MemoryReadContext): Promise<readonly MemoryRecord[]>;
  write(records: readonly MemoryRecord[], context: MemoryWriteContext): Promise<void>;
  store?(entry: MemoryRecord, context: MemoryWriteContext): Promise<MemoryEntry>;
  retrieve?(context: MemoryReadContext): Promise<readonly MemoryEntry[]>;
  search?(query: MemorySearchQuery): Promise<readonly MemoryEntry[]>;
  delete?(id: string): Promise<void>;
}

/**
 * Selects memories relevant to a run.
 */
export interface MemoryRetrievalStrategy {
  retrieve(provider: MemoryProvider, context: MemoryReadContext): Promise<readonly MemoryEntry[]>;
}

/**
 * Compacts conversation history to fit provider context windows.
 */
export interface ContextCompactor {
  compact(
    messages: readonly Message[],
    options?: ContextCompactionOptions
  ): Promise<ConversationContext>;
}

/**
 * Options for context compaction.
 */
export interface ContextCompactionOptions {
  readonly maxMessages?: number;
}

/**
 * Prepared context after memory injection and compaction.
 */
export interface ConversationContext {
  readonly messages: readonly Message[];
  readonly compacted: boolean;
  readonly summary?: string;
}

/**
 * Default memory retrieval strategy.
 */
export class DefaultMemoryRetrievalStrategy implements MemoryRetrievalStrategy {
  async retrieve(
    provider: MemoryProvider,
    context: MemoryReadContext
  ): Promise<readonly MemoryEntry[]> {
    if (provider.retrieve !== undefined) {
      return provider.retrieve(context);
    }

    const records = await provider.read(context);
    return Object.freeze(records.map((record) => toMemoryEntry(record)));
  }
}

/**
 * Trims old messages and keeps a summary marker as an extension point.
 */
export class DefaultContextCompactor implements ContextCompactor {
  readonly #maxMessages: number;

  constructor(maxMessages = 24) {
    this.#maxMessages = maxMessages;
  }

  async compact(
    messages: readonly Message[],
    options: ContextCompactionOptions = {}
  ): Promise<ConversationContext> {
    await Promise.resolve();
    const maxMessages = options.maxMessages ?? this.#maxMessages;

    if (messages.length <= maxMessages) {
      return Object.freeze({
        compacted: false,
        messages: Object.freeze([...messages]),
      });
    }

    const removed = messages.length - maxMessages;
    const summary = `Conversation compacted. ${String(removed)} earlier messages were summarized by a future compactor.`;
    return Object.freeze({
      compacted: true,
      messages: Object.freeze([
        Object.freeze({
          content: summary,
          role: MessageRole.System,
        }),
        ...messages.slice(-maxMessages),
      ]),
      summary,
    });
  }
}

/**
 * In-memory memory provider for development and tests.
 */
export class InMemoryMemoryProvider implements MemoryProvider {
  readonly #entries: MemoryEntry[] = [];

  async read(): Promise<readonly MemoryRecord[]> {
    await Promise.resolve();
    return Object.freeze([...this.#entries]);
  }

  async write(records: readonly MemoryRecord[], context: MemoryWriteContext): Promise<void> {
    await Promise.resolve();
    for (const record of records) {
      this.#entries.push(toMemoryEntry(record, context));
    }
  }

  async store(entry: MemoryRecord, context: MemoryWriteContext): Promise<MemoryEntry> {
    await Promise.resolve();
    const stored = toMemoryEntry(entry, context);
    this.#entries.push(stored);
    return stored;
  }

  async retrieve(): Promise<readonly MemoryEntry[]> {
    await Promise.resolve();
    return Object.freeze([...this.#entries]);
  }

  async search(query: MemorySearchQuery): Promise<readonly MemoryEntry[]> {
    await Promise.resolve();
    const limit = query.limit ?? 10;
    return Object.freeze(
      this.#entries.filter((entry) => entry.content.includes(query.query)).slice(0, limit)
    );
  }

  async delete(id: string): Promise<void> {
    await Promise.resolve();
    const index = this.#entries.findIndex((entry) => entry.id === id);

    if (index >= 0) {
      this.#entries.splice(index, 1);
    }
  }
}

/**
 * Coordinates memory retrieval and persistence independently from Runner.
 */
export class MemoryManager {
  readonly #provider: MemoryProvider;
  readonly #retrieval: MemoryRetrievalStrategy;

  constructor(
    provider: MemoryProvider = new InMemoryMemoryProvider(),
    retrieval: MemoryRetrievalStrategy = new DefaultMemoryRetrievalStrategy()
  ) {
    this.#provider = provider;
    this.#retrieval = retrieval;
  }

  /** Stores one memory entry. */
  async store(entry: MemoryRecord, context: MemoryWriteContext): Promise<MemoryEntry> {
    if (this.#provider.store !== undefined) {
      return this.#provider.store(entry, context);
    }

    await this.#provider.write([entry], context);
    return toMemoryEntry(entry, context);
  }

  /** Retrieves relevant memory for a run. */
  async retrieve(context: MemoryReadContext): Promise<readonly MemoryEntry[]> {
    return this.#retrieval.retrieve(this.#provider, context);
  }

  /** Searches memory when supported. */
  async search(query: MemorySearchQuery): Promise<readonly MemoryEntry[]> {
    return this.#provider.search?.(query) ?? Object.freeze([]);
  }

  /** Deletes memory when supported. */
  async delete(id: string): Promise<void> {
    await this.#provider.delete?.(id);
  }
}

function toMemoryEntry(record: MemoryRecord, context?: MemoryWriteContext): MemoryEntry {
  const entry: Partial<MutableMemoryEntry> = {
    content: record.content,
    id: record.id ?? `memory_${crypto.randomUUID()}`,
    timestamp: new Date(),
  };

  if (record.score !== undefined) {
    entry.score = record.score;
  }

  if (record.metadata !== undefined || context?.metadata !== undefined) {
    entry.metadata = Object.freeze({
      ...(context?.metadata ?? {}),
      ...(record.metadata ?? {}),
    });
  }

  return Object.freeze(entry) as MemoryEntry;
}

type MutableMemoryEntry = {
  -readonly [Key in keyof MemoryEntry]: MemoryEntry[Key];
};
