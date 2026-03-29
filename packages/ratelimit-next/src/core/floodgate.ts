import type {
  FloodgateConfig,
  RateLimitResult,
  Store,
} from "./types.js";
import { RateLimitError } from "./types.js";
import { MemoryStore } from "./store.js";
import { fixedWindow, slidingWindow, tokenBucket } from "./algorithms.js";

export interface Floodgate {
  /** Check a rate limit rule without blocking. Returns the result. */
  check(ruleName: string, key?: string): Promise<RateLimitResult>;
  /** Check a rate limit rule and throw RateLimitError if exceeded. */
  limit(ruleName: string, key?: string): Promise<RateLimitResult>;
  /** Reset the rate limit for a specific key under a rule. */
  reset(ruleName: string, key: string): Promise<void>;
  /** Generate standard rate-limit HTTP headers from a result. */
  headers(result: RateLimitResult): Record<string, string>;
  /** Access the underlying store (useful for cleanup). */
  readonly store: Store;
}

/**
 * Create a floodgate instance from configuration.
 *
 * @example
 * const gate = createFloodgate({
 *   rules: {
 *     api: { limit: 100, window: "1m" },
 *     auth: { limit: 5, window: "15m", algorithm: "fixed-window" },
 *   },
 * });
 */
export function createFloodgate(config: FloodgateConfig): Floodgate {
  const store = config.store ?? new MemoryStore();

  function getRule(ruleName: string) {
    const rule = config.rules[ruleName];
    if (!rule) {
      throw new Error(
        `Unknown rate limit rule "${ruleName}". Available rules: ${Object.keys(config.rules).join(", ")}`
      );
    }
    return rule;
  }

  async function runAlgorithm(
    ruleName: string,
    key: string
  ): Promise<RateLimitResult> {
    const rule = getRule(ruleName);
    const algorithm = rule.algorithm ?? "sliding-window";
    const fullKey = `${ruleName}:${key}`;

    switch (algorithm) {
      case "fixed-window":
        return fixedWindow(store, fullKey, rule);
      case "sliding-window":
        return slidingWindow(store, fullKey, rule);
      case "token-bucket":
        return tokenBucket(store, fullKey, rule);
      default:
        throw new Error(`Unknown algorithm "${algorithm}".`);
    }
  }

  return {
    store,

    async check(ruleName: string, key = "global"): Promise<RateLimitResult> {
      return runAlgorithm(ruleName, key);
    },

    async limit(ruleName: string, key = "global"): Promise<RateLimitResult> {
      const result = await runAlgorithm(ruleName, key);
      if (!result.allowed) {
        throw new RateLimitError(result);
      }
      return result;
    },

    async reset(ruleName: string, key: string): Promise<void> {
      const fullKey = `${ruleName}:${key}`;
      // Clear all possible algorithm keys
      await Promise.all([
        store.set(`fw:${fullKey}:0`, "0", 1),
        store.set(`sw:${fullKey}:0`, "0", 1),
        store.set(`tb:${fullKey}:bucket`, String(getRule(ruleName).limit), 1),
        store.set(`tb:${fullKey}:ts`, "0", 1),
      ]);
    },

    headers(result: RateLimitResult): Record<string, string> {
      const h: Record<string, string> = {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
      };
      if (result.retryAfter !== undefined) {
        h["Retry-After"] = String(result.retryAfter);
      }
      return h;
    },
  };
}
