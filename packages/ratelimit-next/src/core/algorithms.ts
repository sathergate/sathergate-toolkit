import type { Store, RateLimitConfig, RateLimitResult } from "./types.js";

/**
 * Parse a window duration string into milliseconds.
 * Supported suffixes: s (seconds), m (minutes), h (hours), d (days).
 *
 * @example parseWindow("1m")  // 60000
 * @example parseWindow("30s") // 30000
 * @example parseWindow("2h")  // 7200000
 */
export function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `Invalid window format "${window}". Use a number followed by s, m, h, or d (e.g. "1m", "30s", "2h").`
    );
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit]!;
}

/**
 * Fixed-window algorithm.
 * Divides time into fixed intervals. Requests are counted within the current interval.
 */
export async function fixedWindow(
  store: Store,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowMs = parseWindow(config.window);
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const storeKey = `fw:${key}:${windowStart}`;

  const count = await store.increment(storeKey, windowMs);
  const allowed = count <= config.limit;
  const remaining = Math.max(0, config.limit - count);
  const reset = windowEnd;

  return {
    allowed,
    limit: config.limit,
    remaining,
    reset,
    ...(allowed ? {} : { retryAfter: Math.ceil((reset - now) / 1000) }),
  };
}

/**
 * Sliding-window algorithm.
 * Approximates a sliding window by weighting the previous fixed window's count
 * based on how far we are into the current window.
 */
export async function slidingWindow(
  store: Store,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowMs = parseWindow(config.window);
  const now = Date.now();
  const currentWindowStart = Math.floor(now / windowMs) * windowMs;
  const previousWindowStart = currentWindowStart - windowMs;

  const currentKey = `sw:${key}:${currentWindowStart}`;
  const previousKey = `sw:${key}:${previousWindowStart}`;

  // Get previous window count before incrementing current
  const prevRaw = await store.get(previousKey);
  const previousCount = prevRaw ? parseInt(prevRaw, 10) : 0;

  // Increment current window
  const currentCount = await store.increment(currentKey, windowMs * 2);

  // Weight of the previous window: proportion of the previous window still "active"
  const elapsed = now - currentWindowStart;
  const weight = Math.max(0, 1 - elapsed / windowMs);
  const estimatedCount = previousCount * weight + currentCount;

  const allowed = estimatedCount <= config.limit;
  const remaining = Math.max(0, Math.floor(config.limit - estimatedCount));
  const reset = currentWindowStart + windowMs;

  return {
    allowed,
    limit: config.limit,
    remaining,
    reset,
    ...(allowed ? {} : { retryAfter: Math.ceil((reset - now) / 1000) }),
  };
}

/**
 * Token-bucket algorithm.
 * Tokens are added at a steady rate. Each request consumes one token.
 * The bucket starts full and refills over the window period.
 */
export async function tokenBucket(
  store: Store,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowMs = parseWindow(config.window);
  const now = Date.now();
  const bucketKey = `tb:${key}:bucket`;
  const tsKey = `tb:${key}:ts`;

  // Refill rate: tokens per millisecond
  const refillRate = config.limit / windowMs;

  // Get current bucket state
  const [tokensRaw, lastRefillRaw] = await Promise.all([
    store.get(bucketKey),
    store.get(tsKey),
  ]);

  let tokens: number;
  if (tokensRaw === null || lastRefillRaw === null) {
    // First request: bucket starts full (minus 1 for this request)
    tokens = config.limit;
  } else {
    const lastRefill = parseInt(lastRefillRaw, 10);
    const elapsed = now - lastRefill;
    const refilled = elapsed * refillRate;
    tokens = Math.min(config.limit, parseFloat(tokensRaw) + refilled);
  }

  const allowed = tokens >= 1;
  const newTokens = allowed ? tokens - 1 : tokens;
  const ttl = windowMs * 2; // Keep state for 2 windows

  await Promise.all([
    store.set(bucketKey, String(newTokens), ttl),
    store.set(tsKey, String(now), ttl),
  ]);

  const remaining = Math.max(0, Math.floor(newTokens));
  // Time until at least one token is available
  const timeUntilToken = allowed ? 0 : Math.ceil((1 - tokens) / refillRate);
  const reset = now + Math.ceil((config.limit - newTokens) / refillRate);

  return {
    allowed,
    limit: config.limit,
    remaining,
    reset,
    ...(allowed ? {} : { retryAfter: Math.ceil(timeUntilToken / 1000) }),
  };
}
