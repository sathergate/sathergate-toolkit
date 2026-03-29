# ratelimit-next

Rate limiting for Next.js. Zero dependencies.

Declarative rules, type-safe API, pluggable stores. Works in Edge Runtime, Node.js, and serverless.

## Install

```bash
npm install ratelimit-next
```

## Quick Start

### 1. Define rules

```ts
// lib/rate-limit.ts
import { createFloodgate } from "ratelimit-next";

export const gate = createFloodgate({
  rules: {
    api: { limit: 100, window: "1m" },
    auth: { limit: 5, window: "15m", algorithm: "fixed-window" },
    uploads: { limit: 10, window: "1h", algorithm: "token-bucket" },
  },
});
```

### 2. Protect routes

```ts
// app/api/data/route.ts
import { withRateLimit } from "ratelimit-next/next";
import { gate } from "@/lib/rate-limit";

export const GET = withRateLimit(gate, "api", async (request) => {
  return Response.json({ data: "hello" });
});
```

### 3. Done

Clients get standard rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) on every response and a `429` with `Retry-After` when limited.

## Algorithms

### Fixed Window

Divides time into fixed intervals and counts requests per interval. Simple and predictable, but allows bursts at window boundaries.

```ts
{ limit: 100, window: "1m", algorithm: "fixed-window" }
```

### Sliding Window (default)

Approximates a true sliding window by weighting the previous interval's count. Smoother than fixed window with minimal overhead.

```ts
{ limit: 100, window: "1m", algorithm: "sliding-window" }
```

### Token Bucket

Tokens refill at a steady rate. Allows short bursts while maintaining an average rate. Best for APIs where occasional spikes are acceptable.

```ts
{ limit: 100, window: "1m", algorithm: "token-bucket" }
```

## Window Format

Duration strings: `"10s"` (seconds), `"5m"` (minutes), `"1h"` (hours), `"1d"` (days).

## Next.js Middleware

Apply rate limiting globally via Next.js middleware:

```ts
// middleware.ts
import { createFloodgate } from "ratelimit-next";
import { createRateLimitMiddleware } from "ratelimit-next/next";

const gate = createFloodgate({
  rules: { api: { limit: 100, window: "1m" } },
});

export default createRateLimitMiddleware(gate, {
  rule: "api",
  paths: ["/api/"],
});

export const config = { matcher: "/api/:path*" };
```

## API Route Protection

Three styles to choose from:

### `withRateLimit` (HOF)

```ts
import { withRateLimit } from "ratelimit-next/next";

export const GET = withRateLimit(gate, "api", async (request) => {
  return Response.json({ ok: true });
});
```

### `rateLimit` (guard)

```ts
import { rateLimit } from "ratelimit-next/next";

export async function GET(request: Request) {
  const limited = await rateLimit(gate, "api", request);
  if (limited) return limited;

  return Response.json({ ok: true });
}
```

### `gate.limit` (throws)

```ts
import { gate } from "@/lib/rate-limit";
import { RateLimitError } from "ratelimit-next";

export async function GET(request: Request) {
  try {
    await gate.limit("api", ip(request));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    throw e;
  }
}
```

## React

Client-side components for rate-limit-aware UIs:

```tsx
import { RateLimited, useRateLimit, RateLimitProvider } from "ratelimit-next/react";

// Wrap your app (optional — configures the check endpoint)
<RateLimitProvider endpoint="/api/rate-limit">
  <App />
</RateLimitProvider>

// Declarative
<RateLimited rule="api-calls" fallback={<p>Too many requests. Please wait.</p>}>
  <MyForm />
</RateLimited>

// Hook
function SubmitButton() {
  const { allowed, remaining, check } = useRateLimit("api-calls");
  return (
    <button disabled={!allowed} onClick={() => { /* submit */ await check(); }}>
      Submit ({remaining} left)
    </button>
  );
}
```

The React components call `GET /api/rate-limit?rule=<name>` to check status. Implement this endpoint with your floodgate instance:

```ts
// app/api/rate-limit/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rule = url.searchParams.get("rule") ?? "api";
  const result = await gate.check(rule);
  return Response.json(result);
}
```

## Stores

### Memory (default)

Zero-config, works everywhere. State is lost on restart. Good for development and single-instance deployments.

```ts
import { createFloodgate, MemoryStore } from "ratelimit-next";

const gate = createFloodgate({
  rules: { api: { limit: 100, window: "1m" } },
  store: new MemoryStore(), // this is the default
});
```

### Redis

For multi-instance deployments. Requires `ioredis`.

```ts
import Redis from "ioredis";
import { createFloodgate } from "ratelimit-next";
import { createRedisStore } from "ratelimit-next/adapters/redis";

const gate = createFloodgate({
  rules: { api: { limit: 100, window: "1m" } },
  store: createRedisStore(new Redis(process.env.REDIS_URL)),
});
```

### Vercel KV

For Vercel deployments. Requires `@vercel/kv`.

```ts
import { kv } from "@vercel/kv";
import { createFloodgate } from "ratelimit-next";
import { createVercelKVStore } from "ratelimit-next/adapters/vercel-kv";

const gate = createFloodgate({
  rules: { api: { limit: 100, window: "1m" } },
  store: createVercelKVStore(kv),
});
```

## Custom Key Resolvers

By default, rate limits are keyed by IP address. Customize this:

```ts
const gate = createFloodgate({
  rules: { api: { limit: 100, window: "1m" } },
  keyResolver: (request) => {
    // Key by API token
    return request.headers.get("Authorization") ?? "anonymous";
  },
});
```

Or pass keys directly:

```ts
const result = await gate.check("api", userId);
```

## API Reference

### `createFloodgate(config)`

Returns a `Floodgate` instance with:

| Method | Description |
|---|---|
| `check(rule, key?)` | Check limit, returns `RateLimitResult` |
| `limit(rule, key?)` | Check limit, throws `RateLimitError` if exceeded |
| `reset(rule, key)` | Clear limit for a key |
| `headers(result)` | Generate HTTP headers from a result |

### `RateLimitResult`

```ts
{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;       // timestamp ms
  retryAfter?: number; // seconds (present when blocked)
}
```

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
