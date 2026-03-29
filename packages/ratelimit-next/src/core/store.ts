import type { Store } from "./types.js";

interface Entry {
  value: string;
  expiresAt: number;
}

const CLEANUP_INTERVAL = 60_000;

/**
 * In-memory store with TTL support. Edge-runtime compatible (no Node.js-specific APIs).
 * Cleans up expired entries lazily on access, avoiding timer lifecycle issues in serverless.
 */
export class MemoryStore implements Store {
  private data = new Map<string, Entry>();
  private lastCleanup = Date.now();

  async get(key: string): Promise<string | null> {
    this.maybeCleanup();
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.maybeCleanup();
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    this.maybeCleanup();
    const existing = this.data.get(key);
    if (!existing || Date.now() > existing.expiresAt) {
      this.data.set(key, { value: "1", expiresAt: Date.now() + ttlMs });
      return 1;
    }
    const next = parseInt(existing.value, 10) + 1;
    existing.value = String(next);
    return next;
  }

  /** Remove all expired entries if enough time has elapsed. */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL) return;
    this.lastCleanup = now;
    for (const [key, entry] of this.data) {
      if (now > entry.expiresAt) {
        this.data.delete(key);
      }
    }
  }

  /** Clear all data. */
  destroy(): void {
    this.data.clear();
  }
}
