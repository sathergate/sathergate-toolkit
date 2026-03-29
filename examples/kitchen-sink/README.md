# Kitchen Sink Example

A minimal Next.js app demonstrating five **sathergate-toolkit** packages working together:

| Package | Role in this example |
|---------|---------------------|
| **searchcraft** | Full-text search over articles with BM25 scoring |
| **ratelimit-next** | Rate limits the search API at 30 req/min per IP |
| **flagpost** | Feature flags with percentage rollouts and targeting |
| **croncall** | Scheduled jobs (daily cleanup, 30-min index refresh) |
| **vaultbox** | Secrets management for API keys |

## Quick Start

```bash
# From the repo root
npm install
npm run build

# Run the example
cd examples/kitchen-sink
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try searching for "cron", "search", or "rate limiting".

## What to Explore

- **`/api/search?q=cron`** — Rate-limited search endpoint
- **`/api/cron`** — Trigger cron jobs and view schedule
- **`lib/flags.ts`** — Feature flag definitions with rollout rules
- **`lib/search.ts`** — Search index with weighted schema
- **`lib/limiter.ts`** — Rate limit configuration
- **`lib/cron.ts`** — Cron job definitions with retry config

## How It Works

The search API route (`app/api/search/route.ts`) shows cross-package composition:

1. **ratelimit-next** checks the rate limit before processing
2. **searchcraft** runs a BM25 search with optional fuzzy matching
3. Rate limit headers are included in the response

This is the pattern for most real-world usage — packages compose naturally through standard imports.
