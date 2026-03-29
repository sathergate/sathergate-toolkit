# Signal Demo App — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Location:** `examples/signal/`

---

## Overview

Signal is a lightweight developer discovery hub — a single-page Next.js app where developers can browse, search, and submit tools, articles, and job opportunities. It is the canonical demo for `sathergate-toolkit`, showing how five packages compose naturally as invisible infrastructure in a real product.

The primary audience is developers evaluating the toolkit. The app should feel like something an agent spun up in a single session: a believable product with polished UI, where the infra just works.

---

## Approach

**Single polished page** (`examples/signal/`), new workspace package alongside `examples/kitchen-sink`. Leaves kitchen-sink untouched.

- One route (`/`) with feed, search, filter tabs, and submit modal
- Tailwind CSS for styling (dark mode default)
- 20 hardcoded seed items in `lib/data.ts`
- All toolkit packages wired for real — no mocking, no stubs

---

## File Structure

```
examples/signal/
├── app/
│   ├── page.tsx                  # Feed page — client component
│   ├── layout.tsx                # Root layout, Geist font, metadata
│   └── api/
│       ├── search/route.ts       # GET — ratelimit-next + searchcraft
│       ├── submit/route.ts       # POST — ratelimit-next (strict)
│       └── cron/route.ts         # GET — croncall handler
├── components/
│   ├── FeedItem.tsx              # Card with two flag-controlled variants
│   ├── SubmitModal.tsx           # Submit form + 429 countdown state
│   └── FilterTabs.tsx            # All / Tools / Links / Opportunities / Trending
├── lib/
│   ├── data.ts                   # 20 seed SignalItems
│   ├── search.ts                 # searchcraft sifter (title×2, description, tags)
│   ├── limiter.ts                # ratelimit-next: search=60/min, submit=5/hr
│   ├── flags.ts                  # flagpost: new_feed_layout (50%), trending_v2
│   └── cron.ts                   # croncall: hourly trending, daily prune
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Data Model

```ts
type ItemType = 'tool' | 'link' | 'opportunity'

interface SignalItem {
  id: string           // slug, e.g. "searchcraft"
  type: ItemType
  title: string
  description: string
  url: string
  tags: string[]
  votes: number
  comments: number
  submittedAt: string  // ISO-8601
  trendingScore: number  // recomputed by croncall hourly
  source?: string      // display domain for links
  salary?: string      // opportunities only
  location?: string    // opportunities only
}
```

### Seed items (20 total)

| # | Type | Title |
|---|------|-------|
| 1–5 | tool | searchcraft, ratelimit-next, flagpost, croncall, vaultbox |
| 6–8 | tool | Zod, Drizzle ORM, Biome |
| 9–16 | link | The end of the localhost era · Why I stopped using ORMs · Ship faster with feature flags · Rate limiting is not optional · Turbopack is finally ready · The case for zero-dependency libraries · Next.js 15: what's new · Cron jobs in serverless: a survival guide |
| 17–20 | opportunity | Senior Engineer — Vercel · Staff Engineer — Linear · DX Engineer — Planetscale · Open Source Lead — tRPC |

### Trending score formula

```ts
// HN-style gravity, recomputed hourly by croncall
const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000
item.trendingScore = item.votes / ((ageHours + 2) ** 1.5)
// Badge shown when trendingScore > 5
// Daily prune: remove items where ageHours > 720 && trendingScore < 0.1
```

---

## Components

### `FeedItem.tsx`
Renders one item. Accepts a `variant: 'compact' | 'card'` prop driven by the `new_feed_layout` flag.

- **compact** (default): single row — icon, title, type badge, upvotes + age on one line
- **card** (flag=true): expanded card — icon, title, type badge, description, tags, footer bar with votes/comments/source

### `SubmitModal.tsx`
Form fields: title, URL, type selector (Tool / Link / Job). On submit:
- `POST /api/submit`
- **Success**: appends item to feed state, closes modal
- **429**: shows "Submission limit reached — try again in N minutes" using `Retry-After` header value; Submit button disabled

### `FilterTabs.tsx`
Horizontal pill tabs: **All · 🛠 Tools · 🔗 Links · 💼 Opportunities · 🔥 Trending**

Client-side filter — no API call. "Trending" tab filters to items with `trendingScore > 5`.

### `page.tsx`
Client component. State: `query`, `items` (seed + submitted), `activeFilter`, `showModal`.

Search: 300ms debounced fetch to `/api/search?q=…`. Replaces `items` with results on success, shows toast on 429. Reverts to seed data when query is cleared.

Flag evaluated once on mount via `fp.evaluateAll({ userId: 'demo-user' })`. Passed as `variant` to every `FeedItem`.

Footer bar (always visible): active flag names · rate limit config · cron schedule.

---

## API Routes

### `GET /api/search`
1. Extract IP from `x-forwarded-for`
2. `limiter.check('search', ip)` — 60 req/min sliding window
3. Return `429` with `limiter.headers(result)` if over limit
4. Parse `q` and `fuzzy` params; run `sifter.search(q, { fuzzy })`
5. Return `{ results, count }` with rate limit headers

### `POST /api/submit`
1. `limiter.check('submit', ip)` — 5 req/hr fixed window
2. Return `429` with `Retry-After` header if over limit
3. Parse body: `{ title, url, type, description? }`
4. Return new item with generated id, current timestamp, zero votes/comments, computed initial trendingScore

### `GET /api/cron`
Delegated entirely to `createCronHandler(tower)` from `croncall/next`. Secret validated automatically from `CRON_SECRET` env var (read via vaultbox in `lib/cron.ts`).

---

## Toolkit Wiring

| Package | Config | Visible effect |
|---------|--------|----------------|
| **searchcraft** | `lib/search.ts` — schema: `{ title: { weight: 2 }, description: true, tags: true }` | Live BM25 search results as you type |
| **ratelimit-next** | `lib/limiter.ts` — `search: { limit: 60, window: '1m' }`, `submit: { limit: 5, window: '1h' }` | Real 429 + Retry-After on submit; toast on search |
| **flagpost** | `lib/flags.ts` — `new_feed_layout: { defaultValue: false, rules: [{ value: true, percentage: 50 }] }` | Card layout switches at ~50% rollout |
| **croncall** | `lib/cron.ts` — `trending: '0 * * * *'`, `prune: '@daily'` | Trending scores + 🔥 badges |
| **vaultbox** | `lib/cron.ts` — reads `CRON_SECRET` | Secret management pattern shown |

---

## Styling

- Tailwind CSS v4 (matches root monorepo devDependency)
- Dark mode by default — `bg-slate-950` base, `bg-slate-800` cards
- Indigo accent (`bg-indigo-600`) for primary actions
- Type badge colors: tool=violet, link=green, opportunity=red
- Geist font via `next/font/local` (already used in root)

---

## Out of Scope

- Authentication / user accounts
- Persistent storage (all state in-memory / seed data)
- Comments or upvote interactions (counts shown but not interactive)
- Individual item detail page
- notifykit / shutterbox (not needed for this use case)

---

## Success Criteria

1. `npm run dev` from `examples/signal/` starts cleanly
2. Searching "cron" returns relevant results
3. Submitting a 6th item within an hour returns a visible 429 with countdown
4. Reloading with a different `userId` seed occasionally shows the card variant
5. `GET /api/cron` returns job schedule metadata
6. Footer accurately reflects active flags and rate limit config
