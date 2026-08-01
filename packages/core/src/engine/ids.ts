import { randomUUID } from "node:crypto";

/**
 * Generates framework identifiers without external dependencies.
 */
export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
