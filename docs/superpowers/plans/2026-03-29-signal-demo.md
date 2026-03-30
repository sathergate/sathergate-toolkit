# Signal Demo App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `examples/signal/` — a polished single-page Next.js app demonstrating five sathergate-toolkit packages as invisible infrastructure in a believable developer discovery feed.

**Architecture:** Single client-side page (`app/page.tsx`) renders seed data from `lib/data.ts` and manages all state locally. Three API routes handle search (searchcraft + ratelimit-next), submit (ratelimit-next), and cron (croncall). flagpost controls a card layout A/B variant; vaultbox reads the cron secret.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, searchcraft, ratelimit-next, flagpost, croncall, vaultbox (all via workspace `*`)

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Deps: next, react, toolkit packages, tailwind |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `next.config.ts` | Minimal Next.js config |
| `tsconfig.json` | Extends `../../tsconfig.base.json` |
| `app/layout.tsx` | Root layout, Geist font, metadata, Tailwind base |
| `app/globals.css` | Tailwind v4 `@import "tailwindcss"` |
| `app/page.tsx` | Feed page: state, search debounce, flag eval, submit |
| `app/api/search/route.ts` | GET: ratelimit-next check → searchcraft query |
| `app/api/submit/route.ts` | POST: ratelimit-next check → return new item |
| `app/api/cron/route.ts` | GET: croncall handler (secret via vaultbox) |
| `components/FeedItem.tsx` | Single item card — compact and card variants |
| `components/FilterTabs.tsx` | Pill tab bar — All/Tools/Links/Opportunities/Trending |
| `components/SubmitModal.tsx` | Submit form with 429 countdown state |
| `lib/data.ts` | 20 seed SignalItems with trendingScores |
| `lib/search.ts` | createSifter over seed data |
| `lib/limiter.ts` | createFloodgate: search=60/min, submit=5/hr |
| `lib/flags.ts` | createFlagpost: new_feed_layout at 50% |
| `lib/cron.ts` | createClockTower: hourly trending recompute |
| `lib/types.ts` | SignalItem, ItemType, FilterTab types |

---

## Task 1: Scaffold the package

**Files:**
- Create: `examples/signal/package.json`
- Create: `examples/signal/postcss.config.mjs`
- Create: `examples/signal/next.config.ts`
- Create: `examples/signal/tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@sathergate/example-signal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  },
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
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 3: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Install deps from repo root**

```bash
npm install
```

Expected: no errors; `examples/signal/node_modules` symlinks toolkit packages.

- [ ] **Step 6: Commit**

```bash
git add examples/signal/package.json examples/signal/postcss.config.mjs examples/signal/next.config.ts examples/signal/tsconfig.json
git commit -m "feat(signal): scaffold package"
```

---

## Task 2: Types and seed data

**Files:**
- Create: `examples/signal/lib/types.ts`
- Create: `examples/signal/lib/data.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export type ItemType = "tool" | "link" | "opportunity";
export type FilterTab = "all" | "tools" | "links" | "opportunities" | "trending";

export interface SignalItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  url: string;
  tags: string[];
  votes: number;
  comments: number;
  submittedAt: string; // ISO-8601
  trendingScore: number;
  source?: string;     // display domain for links
  salary?: string;     // opportunities only
  location?: string;   // opportunities only
}
```

- [ ] **Step 2: Create `lib/data.ts`** with all 20 seed items

```ts
import type { SignalItem } from "./types";

export const SEED_DATA: SignalItem[] = [
  // Tools (1-8)
  {
    id: "searchcraft",
    type: "tool",
    title: "searchcraft",
    description: "BM25 full-text search for Next.js. No external service, works at the edge.",
    url: "https://npmjs.com/package/searchcraft",
    tags: ["search", "bm25", "next.js"],
    votes: 847,
    comments: 24,
    submittedAt: new Date(Date.now() - 12 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "npmjs.com",
  },
  {
    id: "ratelimit-next",
    type: "tool",
    title: "ratelimit-next",
    description: "Zero-dependency rate limiting for Next.js. Sliding window, fixed window, token bucket.",
    url: "https://npmjs.com/package/ratelimit-next",
    tags: ["rate-limiting", "api", "next.js"],
    votes: 612,
    comments: 18,
    submittedAt: new Date(Date.now() - 2 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "npmjs.com",
  },
  {
    id: "flagpost",
    type: "tool",
    title: "flagpost",
    description: "Feature flags for Next.js. One file, full control. Zero dependencies.",
    url: "https://npmjs.com/package/flagpost",
    tags: ["feature-flags", "next.js"],
    votes: 534,
    comments: 15,
    submittedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "npmjs.com",
  },
  {
    id: "croncall",
    type: "tool",
    title: "croncall",
    description: "Serverless-native cron jobs for Next.js. Zero runtime dependencies. TypeScript-first.",
    url: "https://npmjs.com/package/croncall",
    tags: ["cron", "scheduling", "next.js"],
    votes: 389,
    comments: 11,
    submittedAt: new Date(Date.now() - 36 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "npmjs.com",
  },
  {
    id: "vaultbox",
    type: "tool",
    title: "vaultbox",
    description: "Encrypted secrets for Next.js. Store secrets in your repo, decrypt at runtime.",
    url: "https://npmjs.com/package/vaultbox",
    tags: ["secrets", "encryption", "next.js"],
    votes: 291,
    comments: 8,
    submittedAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "npmjs.com",
  },
  {
    id: "zod",
    type: "tool",
    title: "Zod",
    description: "TypeScript-first schema validation with static type inference.",
    url: "https://zod.dev",
    tags: ["validation", "typescript"],
    votes: 1240,
    comments: 42,
    submittedAt: new Date(Date.now() - 7 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "zod.dev",
  },
  {
    id: "drizzle-orm",
    type: "tool",
    title: "Drizzle ORM",
    description: "TypeScript ORM that feels like writing SQL. Lightweight, edge-compatible.",
    url: "https://orm.drizzle.team",
    tags: ["orm", "sql", "typescript"],
    votes: 980,
    comments: 31,
    submittedAt: new Date(Date.now() - 5 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "orm.drizzle.team",
  },
  {
    id: "biome",
    type: "tool",
    title: "Biome",
    description: "One toolchain for your web project. Linter, formatter, and more.",
    url: "https://biomejs.dev",
    tags: ["linting", "formatting", "toolchain"],
    votes: 743,
    comments: 27,
    submittedAt: new Date(Date.now() - 3 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "biomejs.dev",
  },
  // Links (9-16)
  {
    id: "end-of-localhost",
    type: "link",
    title: "The end of the localhost era",
    description: "Why remote dev environments are finally winning — a practical look at the tradeoffs.",
    url: "https://blog.vercel.com/end-of-localhost",
    tags: ["devex", "remote-dev"],
    votes: 512,
    comments: 38,
    submittedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "blog.vercel.com",
  },
  {
    id: "stop-using-orms",
    type: "link",
    title: "Why I stopped using ORMs",
    description: "Raw SQL is not scary. A case for writing queries directly and understanding what runs.",
    url: "https://www.robinwieruch.de/stop-using-orms",
    tags: ["sql", "postgres", "opinion"],
    votes: 431,
    comments: 57,
    submittedAt: new Date(Date.now() - 18 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "robinwieruch.de",
  },
  {
    id: "ship-with-flags",
    type: "link",
    title: "Ship faster with feature flags",
    description: "How trunk-based development + feature flags replaced gitflow at our 30-person team.",
    url: "https://martinfowler.com/articles/feature-toggles.html",
    tags: ["feature-flags", "deployment"],
    votes: 378,
    comments: 22,
    submittedAt: new Date(Date.now() - 2 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "martinfowler.com",
  },
  {
    id: "rate-limiting-mandatory",
    type: "link",
    title: "Rate limiting is not optional",
    description: "Every public API endpoint needs rate limiting. Here's a simple mental model for getting it right.",
    url: "https://stripe.com/blog/rate-limiters",
    tags: ["security", "api", "rate-limiting"],
    votes: 645,
    comments: 19,
    submittedAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "stripe.com",
  },
  {
    id: "turbopack-ready",
    type: "link",
    title: "Turbopack is finally ready",
    description: "After two years of development, Turbopack ships as the default bundler in Next.js 16.",
    url: "https://turbo.build/blog/turbopack-ready",
    tags: ["bundler", "next.js", "performance"],
    votes: 892,
    comments: 63,
    submittedAt: new Date(Date.now() - 8 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "turbo.build",
  },
  {
    id: "zero-dep-libraries",
    type: "link",
    title: "The case for zero-dependency libraries",
    description: "Your dependencies have dependencies. Here's why shipping zero-dep packages is a competitive advantage.",
    url: "https://thenewstack.io/zero-dependency-libraries",
    tags: ["libraries", "philosophy"],
    votes: 287,
    comments: 14,
    submittedAt: new Date(Date.now() - 4 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "thenewstack.io",
  },
  {
    id: "nextjs-15-whats-new",
    type: "link",
    title: "Next.js 15: what's new",
    description: "Async request APIs, Turbopack stable, Cache Components, and the proxy.ts rename.",
    url: "https://nextjs.org/blog/next-15",
    tags: ["next.js", "release"],
    votes: 1103,
    comments: 88,
    submittedAt: new Date(Date.now() - 6 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "nextjs.org",
  },
  {
    id: "cron-serverless-guide",
    type: "link",
    title: "Cron jobs in serverless: a survival guide",
    description: "Idempotency, secret validation, at-least-once delivery — what every cron job needs.",
    url: "https://vercel.com/guides/cron-jobs-serverless",
    tags: ["cron", "serverless"],
    votes: 334,
    comments: 21,
    submittedAt: new Date(Date.now() - 14 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "vercel.com",
  },
  // Opportunities (17-20)
  {
    id: "vercel-senior-eng",
    type: "opportunity",
    title: "Senior Engineer — Vercel",
    description: "Work on the Next.js infrastructure team. Help ship the tools millions of developers use.",
    url: "https://vercel.com/careers",
    tags: ["remote", "infrastructure"],
    votes: 91,
    comments: 5,
    submittedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "vercel.com",
    salary: "$180–240k",
    location: "Remote",
  },
  {
    id: "linear-staff-eng",
    type: "opportunity",
    title: "Staff Engineer — Linear",
    description: "Build the future of project management. Small team, huge impact.",
    url: "https://linear.app/careers",
    tags: ["remote", "product"],
    votes: 74,
    comments: 3,
    submittedAt: new Date(Date.now() - 2 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "linear.app",
    salary: "$200–260k",
    location: "Remote",
  },
  {
    id: "planetscale-dx",
    type: "opportunity",
    title: "DX Engineer — Planetscale",
    description: "Own the developer experience for a serverless MySQL platform used by thousands.",
    url: "https://planetscale.com/careers",
    tags: ["remote", "devex"],
    votes: 58,
    comments: 2,
    submittedAt: new Date(Date.now() - 3 * 24 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "planetscale.com",
    salary: "$150–180k",
    location: "Remote",
  },
  {
    id: "trpc-oss-lead",
    type: "opportunity",
    title: "Open Source Lead — tRPC",
    description: "Maintain and grow one of the most loved TypeScript libraries in the ecosystem.",
    url: "https://trpc.io/careers",
    tags: ["remote", "open-source"],
    votes: 112,
    comments: 7,
    submittedAt: new Date(Date.now() - 12 * 3_600_000).toISOString(),
    trendingScore: 0,
    source: "trpc.io",
    location: "Remote",
    salary: "Contract",
  },
];

// Pre-compute trending scores on import
// HN-style gravity: votes / (ageHours + 2)^1.5
function computeScore(item: SignalItem): number {
  const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000;
  return item.votes / Math.pow(ageHours + 2, 1.5);
}

SEED_DATA.forEach((item) => {
  item.trendingScore = computeScore(item);
});
```

- [ ] **Step 3: Commit**

```bash
git add examples/signal/lib/types.ts examples/signal/lib/data.ts
git commit -m "feat(signal): add types and 20-item seed data"
```

---

## Task 3: Toolkit library files

**Files:**
- Create: `examples/signal/lib/search.ts`
- Create: `examples/signal/lib/limiter.ts`
- Create: `examples/signal/lib/flags.ts`
- Create: `examples/signal/lib/cron.ts`

- [ ] **Step 1: Create `lib/search.ts`**

```ts
import { createSifter } from "searchcraft";
import { SEED_DATA } from "./data";

export const sifter = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: true,
  },
  documents: SEED_DATA,
});
```

- [ ] **Step 2: Create `lib/limiter.ts`**

```ts
import { createFloodgate } from "ratelimit-next";

export const limiter = createFloodgate({
  rules: {
    search: { limit: 60, window: "1m" },
    submit: { limit: 5, window: "1h", algorithm: "fixed-window" },
  },
});
```

- [ ] **Step 3: Create `lib/flags.ts`**

```ts
import { createFlagpost } from "flagpost";

export const fp = createFlagpost({
  flags: {
    new_feed_layout: {
      defaultValue: false,
      description: "Card layout variant — 50% rollout",
      rules: [{ value: true, percentage: 50 }],
    },
  },
});
```

- [ ] **Step 4: Create `lib/cron.ts`**

Uses `process.env.CRON_SECRET` directly (vaultbox pattern shown via `createLockbox` comment — vaultbox requires a `.lockbox-key` file not present in CI, so we fall back to env var for portability).

```ts
import { createClockTower } from "croncall";
import type { SignalItem } from "./types";
import { SEED_DATA } from "./data";

// In a real app: import { createLockbox } from "vaultbox"
// const box = createLockbox()
// const secret = box.require("CRON_SECRET")
// Here we read from env directly for portability in the demo
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

function computeScore(item: SignalItem): number {
  const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000;
  return item.votes / Math.pow(ageHours + 2, 1.5);
}

export const tower = createClockTower({
  jobs: {
    trending: {
      schedule: "0 * * * *",
      handler: async () => {
        // In a real app this would write to a DB.
        // Here we return updated scores for inspection.
        return SEED_DATA.map((item) => ({
          id: item.id,
          trendingScore: computeScore(item),
        }));
      },
      description: "Recompute trending scores hourly",
    },
  },
  secret: CRON_SECRET || undefined,
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd examples/signal && npx tsc --noEmit
```

Expected: no errors (or only "cannot find module" if toolkit packages aren't built yet — run `npm run build` from repo root first if needed).

- [ ] **Step 6: Commit**

```bash
git add examples/signal/lib/
git commit -m "feat(signal): add toolkit lib files (search, limiter, flags, cron)"
```

---

## Task 4: API routes

**Files:**
- Create: `examples/signal/app/api/search/route.ts`
- Create: `examples/signal/app/api/submit/route.ts`
- Create: `examples/signal/app/api/cron/route.ts`

- [ ] **Step 1: Create `app/api/search/route.ts`**

```ts
import { sifter } from "@/lib/search";
import { limiter } from "@/lib/limiter";

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await limiter.check("search", ip);

  if (!result.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: limiter.headers(result) }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const fuzzy = searchParams.get("fuzzy") === "true";

  if (!q.trim()) {
    return Response.json(
      { results: [], count: 0 },
      { headers: limiter.headers(result) }
    );
  }

  const results = sifter.search(q, { limit: 20, fuzzy });

  return Response.json(
    { results: results.map((r) => r.item), count: results.length },
    { headers: limiter.headers(result) }
  );
}
```

- [ ] **Step 2: Create `app/api/submit/route.ts`**

```ts
import { limiter } from "@/lib/limiter";
import type { SignalItem, ItemType } from "@/lib/types";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await limiter.check("submit", ip);

  if (!result.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: limiter.headers(result) }
    );
  }

  const body = await request.json() as {
    title: string;
    url: string;
    type: ItemType;
    description?: string;
  };

  const now = new Date().toISOString();
  const ageHours = 0;
  const votes = 1;
  const trendingScore = votes / Math.pow(ageHours + 2, 1.5);

  const item: SignalItem = {
    id: crypto.randomUUID(),
    type: body.type,
    title: body.title,
    description: body.description ?? "",
    url: body.url,
    tags: [],
    votes,
    comments: 0,
    submittedAt: now,
    trendingScore,
    source: (() => {
      try { return new URL(body.url).hostname; } catch { return undefined; }
    })(),
  };

  return Response.json(item, { status: 201, headers: limiter.headers(result) });
}
```

- [ ] **Step 3: Create `app/api/cron/route.ts`**

```ts
import { tower, CRON_SECRET } from "@/lib/cron";
import { createCronHandler } from "croncall/next";

// Validate secret before delegating to croncall handler
export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return createCronHandler(tower)(request);
}
```

- [ ] **Step 4: Smoke-test routes manually**

Start dev server: `cd examples/signal && npm run dev`

```bash
# Search
curl "http://localhost:3000/api/search?q=cron"
# Expected: { results: [...], count: N }

# Submit
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"title":"My Tool","url":"https://example.com","type":"tool"}'
# Expected: 201 with new SignalItem

# Cron without secret
curl "http://localhost:3000/api/cron"
# Expected: 401 Unauthorized

# Cron with secret (set CRON_SECRET=test-secret in .env.local)
curl -H "Authorization: Bearer test-secret" "http://localhost:3000/api/cron"
# Expected: 200 with job results
```

- [ ] **Step 5: Commit**

```bash
git add examples/signal/app/api/
git commit -m "feat(signal): add search, submit, and cron API routes"
```

---

## Task 5: Layout and globals

**Files:**
- Create: `examples/signal/app/globals.css`
- Create: `examples/signal/app/layout.tsx`

- [ ] **Step 1: Create `app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 2: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — Developer Discovery",
  description: "Browse tools, articles, and opportunities curated for developers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-950 text-slate-100">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/signal/app/globals.css examples/signal/app/layout.tsx
git commit -m "feat(signal): add layout and Tailwind globals"
```

---

## Task 6: FeedItem component

**Files:**
- Create: `examples/signal/components/FeedItem.tsx`

- [ ] **Step 1: Create `components/FeedItem.tsx`**

```tsx
import type { SignalItem } from "@/lib/types";

const TYPE_STYLES = {
  tool: { badge: "bg-violet-900 text-violet-300", icon: "🛠" },
  link: { badge: "bg-green-900 text-green-300", icon: "🔗" },
  opportunity: { badge: "bg-red-900 text-red-300", icon: "💼" },
};

function timeAgo(iso: string): string {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface FeedItemProps {
  item: SignalItem;
  variant: "compact" | "card";
}

export function FeedItem({ item, variant }: FeedItemProps) {
  const { badge, icon } = TYPE_STYLES[item.type];
  const isTrending = item.trendingScore > 5;

  if (variant === "compact") {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
      >
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-slate-100 text-sm truncate">
              {item.title}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge}`}>
              {item.type}
            </span>
            {isTrending && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 shrink-0">
                🔥
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            ↑ {item.votes} · {item.comments} comments ·{" "}
            {item.source ?? item.type} · {timeAgo(item.submittedAt)}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800 rounded-xl overflow-hidden hover:bg-slate-700 transition-colors"
    >
      <div className="p-4">
        <div className="flex justify-between items-start gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <span className="font-semibold text-slate-100">{item.title}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
              {item.type}
            </span>
            {isTrending && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">
                🔥 trending
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">
          {item.description}
        </p>
        {item.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.salary && (
          <div className="text-xs text-slate-500 mb-2">
            {item.location} · {item.salary}
          </div>
        )}
      </div>
      <div className="flex justify-between px-4 py-2 bg-slate-900 text-xs text-slate-600">
        <span>↑ {item.votes}</span>
        <span>💬 {item.comments}</span>
        <span>{item.source ?? item.type}</span>
        <span>{timeAgo(item.submittedAt)}</span>
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/signal/components/FeedItem.tsx
git commit -m "feat(signal): add FeedItem component (compact + card variants)"
```

---

## Task 7: FilterTabs component

**Files:**
- Create: `examples/signal/components/FilterTabs.tsx`

- [ ] **Step 1: Create `components/FilterTabs.tsx`**

```tsx
import type { FilterTab } from "@/lib/types";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tools", label: "🛠 Tools" },
  { id: "links", label: "🔗 Links" },
  { id: "opportunities", label: "💼 Opportunities" },
  { id: "trending", label: "🔥 Trending" },
];

interface FilterTabsProps {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

export function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            active === id
              ? "bg-slate-600 text-slate-100"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/signal/components/FilterTabs.tsx
git commit -m "feat(signal): add FilterTabs component"
```

---

## Task 8: SubmitModal component

**Files:**
- Create: `examples/signal/components/SubmitModal.tsx`

- [ ] **Step 1: Create `components/SubmitModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { ItemType, SignalItem } from "@/lib/types";

interface SubmitModalProps {
  onClose: () => void;
  onSuccess: (item: SignalItem) => void;
}

export function SubmitModal({ onClose, onSuccess }: SubmitModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ItemType>("tool");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, type, description }),
      });

      if (res.status === 429) {
        const retrySeconds = Number(res.headers.get("Retry-After") ?? 3600);
        setRetryAfter(Math.ceil(retrySeconds / 60));
        return;
      }

      const item: SignalItem = await res.json();
      onSuccess(item);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500";

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="font-semibold text-slate-100 mb-4">Submit to Signal</h2>

        {retryAfter !== null ? (
          <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-center mb-4">
            <p className="text-red-400 font-medium text-sm">
              Submission limit reached
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Try again in{" "}
              <span className="text-slate-100 font-medium">
                {retryAfter} minute{retryAfter !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Title *
            </label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome tool"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              URL *
            </label>
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Type
            </label>
            <div className="flex gap-2">
              {(["tool", "link", "opportunity"] as ItemType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors capitalize ${
                    type === t
                      ? "bg-indigo-900 border-indigo-500 text-indigo-300"
                      : "border-slate-700 text-slate-500 hover:border-slate-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Description
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short description"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || retryAfter !== null}
              className="flex-1 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-600 text-center mt-3">
          5 submissions per hour
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/signal/components/SubmitModal.tsx
git commit -m "feat(signal): add SubmitModal with 429 countdown"
```

---

## Task 9: Main page

**Files:**
- Create: `examples/signal/app/page.tsx`

- [ ] **Step 1: Create `app/page.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SEED_DATA } from "@/lib/data";
import { fp } from "@/lib/flags";
import { FeedItem } from "@/components/FeedItem";
import { FilterTabs } from "@/components/FilterTabs";
import { SubmitModal } from "@/components/SubmitModal";
import type { SignalItem, FilterTab } from "@/lib/types";

function getOrCreateUserId(): string {
  if (typeof sessionStorage === "undefined") return "user-demo";
  const stored = sessionStorage.getItem("signal-uid");
  if (stored) return stored;
  const uid = `user-${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem("signal-uid", uid);
  return uid;
}

export default function Home() {
  const [baseItems, setBaseItems] = useState<SignalItem[]>(SEED_DATA);
  const [searchResults, setSearchResults] = useState<SignalItem[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [variant, setVariant] = useState<"compact" | "card">("compact");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evaluate flag once on mount
  useEffect(() => {
    const userId = getOrCreateUserId();
    const flags = fp.evaluateAll({ userId });
    if (flags.new_feed_layout) setVariant("card");
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&fuzzy=true`
      );
      if (res.status === 429) {
        setSearchError("Too many requests — slow down");
        return;
      }
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setSearchError(null);
    } catch {
      setSearchError("Search failed");
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Derive displayed items: search results (or base) filtered by tab
  const displayItems = (searchResults ?? baseItems).filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "tools") return item.type === "tool";
    if (activeFilter === "links") return item.type === "link";
    if (activeFilter === "opportunities") return item.type === "opportunity";
    if (activeFilter === "trending") return item.trendingScore > 5;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="font-bold text-slate-100 text-xl tracking-tight">
          signal
        </h1>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools, articles, opportunities…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Submit
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4">
        <FilterTabs active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Error toast */}
      {searchError && (
        <p className="text-sm text-red-400 mb-3">{searchError}</p>
      )}

      {/* Feed */}
      <div className={variant === "card" ? "flex flex-col gap-3" : "flex flex-col gap-1.5"}>
        {displayItems.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">
            No results{query ? ` for "${query}"` : ""}
          </p>
        ) : (
          displayItems.map((item) => (
            <FeedItem key={item.id} item={item} variant={variant} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-700">
        🚩 new_feed_layout (50% rollout) · 🛡 Search: 60 req/min · Submit: 5 req/hr · ⏰ Trending: hourly cron
      </div>

      {/* Submit modal */}
      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSuccess={(item) => setBaseItems((prev) => [item, ...prev])}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app runs**

```bash
cd examples/signal && npm run dev
```

Open http://localhost:3000. Expected:
- Feed loads with 20 items in compact or card layout
- Search bar works (try "cron")
- Filter tabs narrow the feed
- 🔥 badges appear on trending items
- Footer shows flag/rate limit/cron info

- [ ] **Step 3: Commit**

```bash
git add examples/signal/app/page.tsx
git commit -m "feat(signal): add main page with feed, search, and filter"
```

---

## Task 10: Verify success criteria

- [ ] **Criterion 1:** `npm run dev` starts without errors ✓ (verified in Task 9)

- [ ] **Criterion 2:** Searching "cron" returns ≥ 2 results

```bash
curl "http://localhost:3000/api/search?q=cron"
# Expected: count >= 2 (croncall tool + cron-related articles)
```

- [ ] **Criterion 3:** 6th submit within an hour returns 429 with countdown

Submit 5 times (or set `submit: { limit: 1, window: '1h' }` temporarily in `lib/limiter.ts` for quick testing), then submit once more. Modal should show "Submission limit reached — try again in N minutes".

- [ ] **Criterion 4:** Flag variant differs across sessions

Open in two browser tabs with DevTools → Application → Session Storage. Clear the `signal-uid` key in one tab and reload. The two sessions may use different variants (50% rollout — not guaranteed to differ, but try `user-aaa111` and `user-zzz999` as the stored uid values to see both variants deterministically).

- [ ] **Criterion 5:** Cron endpoint auth

```bash
# No secret → 401
curl http://localhost:3000/api/cron
# With secret (add CRON_SECRET=test-secret to examples/signal/.env.local)
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron
# Expected: 200 with job results
```

- [ ] **Criterion 6:** Footer text matches spec exactly

Inspect the page footer. Should read:
`🚩 new_feed_layout (50% rollout) · 🛡 Search: 60 req/min · Submit: 5 req/hr · ⏰ Trending: hourly cron`

- [ ] **Final commit**

```bash
git add examples/signal/
git commit -m "feat(signal): complete demo app — all success criteria met"
```
