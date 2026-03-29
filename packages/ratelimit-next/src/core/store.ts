import type { Store } from "./types.js";

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-memory store with TTL support. Edge-runtime compatible (no Node.js-specific APIs).
 * Periodically cleans up expired entries every 60 seconds.
 */
export class MemoryStore implements Store {
  private data = new Map<string, Entry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Allow the process to exit even if the timer is still running.
    if (typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const existing = this.data.get(key);
    if (!existing || Date.now() > existing.expiresAt) {
      this.data.set(key, { value: "1", expiresAt: Date.now() + ttlMs });
      return 1;
    }
    const next = parseInt(existing.value, 10) + 1;
    existing.value = String(next);
    return next;
  }

  /** Remove all expired entries. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.data) {
      if (now > entry.expiresAt) {
        this.data.delete(key);
      }
    }
  }

  /** Stop the cleanup timer and clear all data. */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.data.clear();
  }
}
