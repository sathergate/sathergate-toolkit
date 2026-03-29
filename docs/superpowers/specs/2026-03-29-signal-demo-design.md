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
│   ├── flags.ts                  # flagpost: new_feed_layout (50%)
│   └── cron.ts                   # croncall: hourly trending recompute
├── package.json                  # see Dependencies section
├── next.config.ts
├── postcss.config.mjs            # required for Tailwind v4
└── tsconfig.json
```

---

## Dependencies

`package.json` must include:

```json
{
  "dependencies": {
    "croncall": "*",
    "flagpost": "*",
    "ratelimit-next": "*",
    "searchcraft": "*",
    "vaultbox": "*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## Data Model

```ts
type ItemType = 'tool' | 'link' | 'opportunity'

interface SignalItem {
  id: string           // slug, e.g. "searchcraft"
  type: ItemType
  title: string
  description: string  // always present; submit endpoint defaults to "" if omitted
  url: string
  tags: string[]
  votes: number
  comments: number
  submittedAt: string  // ISO-8601
  trendingScore: number  // set on seed data; cron recompute is local-dev only (see Constraints)
  source?: string      // display domain for links, e.g. "blog.vercel.com"
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

Seed items 1–3 (searchcraft, ratelimit-next, flagpost) have high votes and recent `submittedAt` so their initial `trendingScore` exceeds 5 and shows the 🔥 badge.

### Trending score formula

```ts
// HN-style gravity
const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000
item.trendingScore = item.votes / ((ageHours + 2) ** 1.5)
// Badge shown when trendingScore > 5
```

---

## Constraints (Serverless / State)

Signal uses no persistent storage. All item state is in-memory on the client:

- **Seed items** are imported at build time from `lib/data.ts`
- **Submitted items** are appended to client-side React state only; they are not persisted and are lost on reload
- **The cron job** (`/api/cron`) only operates on the 20 hardcoded seed items — it cannot see client-submitted items. In a serverless deployment each function invocation is stateless, so cron mutations are not retained across calls. The cron handler returns the recomputed scores as JSON for inspection; it does not mutate any shared store. This is explicitly a local-dev demo pattern.

---

## Components

### `FeedItem.tsx`
Renders one item. Accepts a `variant: 'compact' | 'card'` prop driven by the `new_feed_layout` flag.

- **compact** (default): single row — icon, title, type badge, upvotes + age on one line
- **card** (flag=true): expanded card — icon, title, type badge, description, tags, footer bar with votes/comments/source

### `SubmitModal.tsx`
Form fields: title (required), URL (required), type selector (Tool / Link / Job), description (optional textarea). On submit:
- `POST /api/submit` with `{ title, url, type, description }`
- **Success**: appends item to client feed state, closes modal
- **429**: shows "Submission limit reached — try again in N minutes" using `Retry-After` header value (in seconds, converted to minutes for display); Submit button disabled

### `FilterTabs.tsx`
Horizontal pill tabs: **All · 🛠 Tools · 🔗 Links · 💼 Opportunities · 🔥 Trending**

Client-side filter applied to `displayItems` (see `page.tsx` state). "Trending" tab filters to items with `trendingScore > 5`.

When a search is active, filter tabs narrow within search results. Clearing the search query reverts to the full `baseItems` list before re-applying the active tab filter.

### `page.tsx`
Client component. State:

```ts
const [baseItems, setBaseItems] = useState<SignalItem[]>(SEED_DATA)  // seed + submitted
const [searchResults, setSearchResults] = useState<SignalItem[] | null>(null)
const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
const [query, setQuery] = useState('')
const [showModal, setShowModal] = useState(false)
const [userId] = useState(() => {
  // Stable per session, varies across sessions for flag rollout demo
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem('signal-uid')
    if (stored) return stored
    const uid = `user-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('signal-uid', uid)
    return uid
  }
  return 'user-demo'
})
```

`displayItems` is derived (not state): `(searchResults ?? baseItems)` filtered by `activeFilter`.

Search: 300ms debounced fetch to `/api/search?q=…`. Sets `searchResults` on success, shows toast on 429. Sets `searchResults` to `null` when query is cleared.

Flag evaluated once on mount: `fp.evaluateAll({ userId })`. The random session userId means the card variant will differ across browser sessions, demonstrating the 50% rollout. Two known stable test values: `userId: 'user-aaa111'` → compact, `userId: 'user-zzz999'` → card (document these in the README).

Submit: calls `POST /api/submit`, on success appends returned item to `baseItems`.

Footer bar (always visible, static text derived from config constants):
```
🚩 new_feed_layout (50% rollout)  ·  🛡 Search: 60 req/min · Submit: 5 req/hr  ·  ⏰ Trending: hourly cron
```

---

## API Routes

### `GET /api/search`
1. Extract IP from `x-forwarded-for` header, fallback `'unknown'`
2. `limiter.check('search', ip)` — 60 req/min sliding window
3. Return `429` with `limiter.headers(result)` if over limit
4. Parse `q` (string) and `fuzzy` (`=true`) params
5. Return `{ results, count }` with rate limit headers on every response

### `POST /api/submit`
1. Extract IP from `x-forwarded-for` header, fallback `'unknown'`
2. `limiter.check('submit', ip)` — 5 req/hr fixed window
3. Return `429` with `Retry-After` header if over limit
4. Parse body: `{ title: string, url: string, type: ItemType, description?: string }`
5. Return new `SignalItem` with: generated id (`crypto.randomUUID()`), current timestamp, zero votes/comments, `description` defaulting to `""`, initial `trendingScore` computed from the formula using age=0

### `GET /api/cron`
Delegated to `createCronHandler(tower)` from `croncall/next`.

Secret: `croncall` validates the `Authorization: Bearer <secret>` header against the value from `CRON_SECRET`. When `CRON_SECRET` is not set, the handler rejects all requests with `401`. The cron handler returns computed trending scores for the 20 seed items as `{ job, scores: SignalItem[] }` — it does not mutate any shared state.

---

## Toolkit Wiring

| Package | Config | Visible effect |
|---------|--------|----------------|
| **searchcraft** | `lib/search.ts` — schema: `{ title: { weight: 2 }, description: true, tags: true }` | Live BM25 search results as you type |
| **ratelimit-next** | `lib/limiter.ts` — `search: { limit: 60, window: '1m' }`, `submit: { limit: 5, window: '1h', algorithm: 'fixed-window' }` | Real 429 + Retry-After on submit; toast on search |
| **flagpost** | `lib/flags.ts` — `new_feed_layout: { defaultValue: false, rules: [{ value: true, percentage: 50 }] }` | Card layout switches per session userId |
| **croncall** | `lib/cron.ts` — `trending: { schedule: '0 * * * *', handler: recomputeScores }` | Trending score recompute endpoint; 🔥 badges driven by seed scores |
| **vaultbox** | `lib/cron.ts` — reads `CRON_SECRET` | Secret read pattern shown; 401 when absent |

---

## Styling

- Tailwind CSS v4 via `@tailwindcss/postcss`
- Dark mode by default — `bg-slate-950` base, `bg-slate-800` cards
- Indigo accent (`bg-indigo-600`) for primary actions
- Type badge colors: tool=violet, link=green, opportunity=red
- Geist font via `next/font/local`

---

## Out of Scope

- Authentication / user accounts
- Persistent storage across reloads
- Comments or upvote interactions (counts shown but not interactive)
- Individual item detail page
- notifykit / shutterbox

---

## Success Criteria

1. `npm run dev` from `examples/signal/` starts without errors
2. Searching "cron" returns at least 2 relevant results
3. Submitting a 6th item within an hour returns a `429` with a visible minute countdown
4. Opening the app in two different browser sessions (clearing sessionStorage between them) shows compact layout in one and card layout in the other — or verify directly: `userId: 'user-aaa111'` → compact, `userId: 'user-zzz999'` → card
5. `GET /api/cron` without `Authorization` header returns `401`; with `Authorization: Bearer test-secret` (and `CRON_SECRET=test-secret`) returns `{ job: 'trending', scores: [...] }`
6. Footer reads exactly: `🚩 new_feed_layout (50% rollout) · 🛡 Search: 60 req/min · Submit: 5 req/hr · ⏰ Trending: hourly cron`
