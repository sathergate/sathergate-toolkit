/** Supported rate limiting algorithms. */
export type Algorithm = "fixed-window" | "sliding-window" | "token-bucket";

/** Configuration for a single rate limit rule. */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Duration string, e.g. "10s", "1m", "1h", "1d". */
  window: string;
  /** Algorithm to use. Defaults to "sliding-window". */
  algorithm?: Algorithm;
}

/** Result of a rate limit check. */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** The configured limit. */
  limit: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Timestamp (ms) when the window resets. */
  reset: number;
  /** Seconds until the client should retry (present when blocked). */
  retryAfter?: number;
}

/** Key-value store abstraction for rate limit state. */
export interface Store {
  /** Get a value by key. Returns null if not found or expired. */
  get(key: string): Promise<string | null>;
  /** Set a value with a TTL in milliseconds. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** Increment a numeric key by 1, initializing to 1 if absent. Returns the new value. TTL is set on first creation. */
  increment(key: string, ttlMs: number): Promise<number>;
}

/** Resolves a request to a rate limit key (e.g. IP address, user ID). */
export type KeyResolver = (request: Request) => string | Promise<string>;

/** Top-level floodgate configuration. */
export interface FloodgateConfig {
  /** Named rate limit rules. */
  rules: Record<string, RateLimitConfig>;
  /** Backing store. Defaults to in-memory. */
  store?: Store;
  /** Key resolver. Defaults to IP-based resolution. */
  keyResolver?: KeyResolver;
}

/** Error thrown when a rate limit is exceeded. */
export class RateLimitError extends Error {
  public readonly result: RateLimitResult;

  constructor(result: RateLimitResult) {
    super(`Rate limit exceeded. Retry after ${result.retryAfter ?? 0}s.`);
    this.name = "RateLimitError";
    this.result = result;
  }
}
