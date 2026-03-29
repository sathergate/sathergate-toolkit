import type { Store } from "../core/types.js";

/**
 * Redis client interface — compatible with ioredis.
 * Only the methods we need are declared so any compatible client works.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: "PX", time: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

/**
 * Create a Store backed by Redis (ioredis-compatible client).
 *
 * @example
 * import Redis from "ioredis";
 * import { createRedisStore } from "ratelimit-next/adapters/redis";
 *
 * const store = createRedisStore(new Redis());
 */
export function createRedisStore(client: RedisClient): Store {
  const PREFIX = "ratelimit-next:";

  return {
    async get(key: string): Promise<string | null> {
      return client.get(PREFIX + key);
    },

    async set(key: string, value: string, ttlMs: number): Promise<void> {
      await client.set(PREFIX + key, value, "PX", ttlMs);
    },

    async increment(key: string, ttlMs: number): Promise<number> {
      const fullKey = PREFIX + key;
      const count = await client.incr(fullKey);
      // Set TTL only on first increment (count === 1)
      if (count === 1) {
        await client.pexpire(fullKey, ttlMs);
      }
      return count;
    },
  };
}
