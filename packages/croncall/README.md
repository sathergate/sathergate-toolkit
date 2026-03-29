# croncall

Cron jobs for Next.js. Serverless-native.

Zero runtime dependencies. TypeScript-first. Works with Vercel Cron out of the box.

## Install

```bash
npm install croncall
```

## Quick Start

### 1. Define your jobs

```ts
// lib/jobs.ts
import { createClockTower } from "croncall";

export const tower = createClockTower({
  jobs: {
    syncUsers: {
      schedule: "0 * * * *", // every hour
      handler: async () => {
        await db.syncUsersFromExternalAPI();
      },
      description: "Sync users from external API",
      retry: { maxAttempts: 3, backoff: "exponential" },
      timeout: 30_000,
    },
    sendDigest: {
      schedule: "0 9 * * 1", // Mondays at 9 AM UTC
      handler: async () => {
        await email.sendWeeklyDigest();
      },
      description: "Send weekly digest email",
    },
    cleanupSessions: {
      schedule: "@daily",
      handler: async () => {
        await db.deleteExpiredSessions();
      },
    },
  },
  secret: process.env.CRON_SECRET,
});
```

### 2. Create a route handler

```ts
// app/api/cron/route.ts
import { createCronHandler } from "croncall/next";
import { tower } from "@/lib/jobs";

export const GET = createCronHandler(tower);
```

### 3. Deploy

Add cron schedules to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron?job=syncUsers", "schedule": "0 * * * *" },
    { "path": "/api/cron?job=sendDigest", "schedule": "0 9 * * 1" },
    { "path": "/api/cron?job=cleanupSessions", "schedule": "0 0 * * *" }
  ]
}
```

Or generate it programmatically:

```ts
import { generateVercelCron } from "croncall/next";
import { tower } from "./lib/jobs";

console.log(JSON.stringify(generateVercelCron(tower, "/api/cron"), null, 2));
```

## Job Definition

Each job has:

| Field         | Type                           | Required | Description                          |
|---------------|--------------------------------|----------|--------------------------------------|
| `schedule`    | `string`                       | Yes      | Cron expression or shortcut          |
| `handler`     | `() => Promise<void>`          | Yes      | Async function to execute            |
| `description` | `string`                       | No       | Human-readable description           |
| `retry`       | `{ maxAttempts, backoff, baseDelay? }` | No | Retry on failure              |
| `timeout`     | `number`                       | No       | Max execution time in ms             |

## Cron Syntax

Standard 5-field cron expressions:

```
 ┌───────────── minute (0-59)
 │ ┌───────────── hour (0-23)
 │ │ ┌───────────── day of month (1-31)
 │ │ │ ┌───────────── month (1-12)
 │ │ │ │ ┌───────────── day of week (0-6, Sun=0)
 │ │ │ │ │
 * * * * *
```

Supported features:
- Wildcards: `*`
- Ranges: `1-5`
- Lists: `1,3,5`
- Steps: `*/15`, `1-30/2`
- Month names: `jan`, `feb`, ..., `dec`
- Day names: `sun`, `mon`, ..., `sat`

Shortcuts:

| Shortcut     | Equivalent      |
|--------------|-----------------|
| `@hourly`    | `0 * * * *`     |
| `@daily`     | `0 0 * * *`     |
| `@midnight`  | `0 0 * * *`     |
| `@weekly`    | `0 0 * * 0`     |
| `@monthly`   | `0 0 1 * *`     |
| `@yearly`    | `0 0 1 1 *`     |
| `@annually`  | `0 0 1 1 *`     |

## Vercel Cron Integration

Clocktower is designed to work with [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs).

### Authentication

Vercel sends a `CRON_SECRET` environment variable and includes it in the `Authorization: Bearer <secret>` header. Clocktower validates this automatically:

1. Checks `options.secret` passed to `createCronHandler`
2. Falls back to `config.secret` from `createClockTower`
3. Falls back to `process.env.CRON_SECRET`

If no secret is configured, requests are allowed without authentication.

### Generating vercel.json

```ts
import { generateVercelCron } from "croncall/next";
import { tower } from "./lib/jobs";

const crons = generateVercelCron(tower, "/api/cron");
// [{ path: "/api/cron?job=syncUsers", schedule: "0 * * * *" }, ...]
```

## Manual Triggers

Run a specific job on demand:

```ts
const result = await tower.run("syncUsers");
console.log(result);
// { success: true, duration: 1234 }
```

Run all due jobs:

```ts
const results = await tower.runDue();
for (const [name, result] of results) {
  console.log(`${name}: ${result.success ? "ok" : result.error}`);
}
```

Via HTTP (useful for testing):

```bash
# Run a specific job
curl http://localhost:3000/api/cron?job=syncUsers \
  -H "Authorization: Bearer your-secret"

# Run all due jobs
curl http://localhost:3000/api/cron \
  -H "Authorization: Bearer your-secret"
```

## Inspect the Schedule

```ts
const schedule = tower.schedule();
// [
//   { jobName: "syncUsers", nextRun: 2026-03-26T15:00:00.000Z, schedule: "0 * * * *" },
//   { jobName: "sendDigest", nextRun: 2026-03-30T09:00:00.000Z, schedule: "0 9 * * 1" },
// ]
```

## Retry & Error Handling

Configure retries per job:

```ts
{
  retry: {
    maxAttempts: 3,          // retry up to 3 times after initial failure
    backoff: "exponential",  // or "linear"
    baseDelay: 1000,         // 1s base delay (default)
  }
}
```

- **Exponential**: delays of 1s, 2s, 4s, 8s, ...
- **Linear**: delays of 1s, 2s, 3s, 4s, ...

The `JobResult` includes `retryCount` when retries were attempted:

```ts
const result = await tower.run("syncUsers");
if (!result.success) {
  console.error(`Failed after ${result.retryCount} retries: ${result.error}`);
}
```

## TypeScript

All types are exported:

```ts
import type {
  CronExpression,
  JobDefinition,
  JobRegistry,
  ClockTowerConfig,
  ClockTower,
  JobResult,
  JobExecution,
  ScheduleEntry,
  RetryConfig,
} from "croncall";
```

Job names are fully typed:

```ts
const tower = createClockTower({
  jobs: {
    syncUsers: { schedule: "@hourly", handler: async () => {} },
  },
});

tower.run("syncUsers");    // OK
tower.run("nonexistent");  // Type error
```

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
- **gatehouse** — Drop-in RBAC for Next.js with role hierarchy (`npm i gatehouse`)
