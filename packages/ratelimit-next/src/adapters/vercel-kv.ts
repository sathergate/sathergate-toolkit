import type { Store } from "../core/types.js";

/**
 * Vercel KV client interface — compatible with @vercel/kv.
 * Only the methods we need are declared.
 */
export interface VercelKVClient {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: string, options?: { px?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
}

/**
 * Create a Store backed by Vercel KV (@vercel/kv).
 *
 * @example
 * import { kv } from "@vercel/kv";
 * import { createVercelKVStore } from "ratelimit-next/adapters/vercel-kv";
 *
 * const store = createVercelKVStore(kv);
 */
export function createVercelKVStore(client: VercelKVClient): Store {
  const PREFIX = "ratelimit-next:";

  return {
    async get(key: string): Promise<string | null> {
      const value = await client.get<string>(PREFIX + key);
      return value ?? null;
    },

    async set(key: string, value: string, ttlMs: number): Promise<void> {
      await client.set(PREFIX + key, value, { px: ttlMs });
    },

    async increment(key: string, ttlMs: number): Promise<number> {
      const fullKey = PREFIX + key;
      const count = await client.incr(fullKey);
      if (count === 1) {
        await client.pexpire(fullKey, ttlMs);
      }
      return count;
    },
  };
}
