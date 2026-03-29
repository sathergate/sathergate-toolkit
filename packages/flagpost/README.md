# flagpost

Feature flags for Next.js. One file, full control.

[![npm version](https://img.shields.io/npm/v/flagpost)](https://www.npmjs.com/package/flagpost)
[![license](https://img.shields.io/npm/l/flagpost)](./LICENSE)

Zero dependencies. Type-safe. Works with Server Components, Client Components, and Middleware.

---

## Install

```bash
npm install flagpost
```

## Quick Start

### 1. Define your flags

```ts
// lib/flags.ts
import { createFlagpost } from "flagpost";

export const fp = createFlagpost({
  flags: {
    darkMode: {
      defaultValue: false,
      description: "Enable dark mode across the app",
    },
    heroVariant: {
      defaultValue: "control" as const,
      description: "A/B test for the hero section",
      rules: [{ value: "experiment" as const, percentage: 50 }],
    },
    maxItems: {
      defaultValue: 10,
      description: "Maximum items per page",
      rules: [{ value: 50, match: { plan: "pro" } }],
    },
  },
  context: async () => ({
    // Resolve user context however you like
    userId: "anonymous",
  }),
});
```

### 2. Protect your UI (Client)

```tsx
// app/page.tsx
"use client";
import { FlagpostProvider, Flag, FlagSwitch } from "flagpost/react";
import { fp } from "@/lib/flags";

export default function App() {
  return (
    <FlagpostProvider flagpost={fp}>
      <Flag name="darkMode" fallback={<LightTheme />}>
        <DarkTheme />
      </Flag>

      <FlagSwitch
        name="heroVariant"
        cases={{
          control: <HeroA />,
          experiment: <HeroB />,
        }}
      />
    </FlagpostProvider>
  );
}
```

### 3. Check server-side

```ts
// app/dashboard/page.tsx (Server Component)
import { flag, flags } from "flagpost/next";
import { fp } from "@/lib/flags";

export default async function Dashboard() {
  const darkMode = await flag(fp, "darkMode");
  const allFlags = await flags(fp);

  return (
    <div className={darkMode ? "dark" : ""}>
      <p>Max items: {allFlags.maxItems}</p>
    </div>
  );
}
```

---

## API Reference

### Core

#### `createFlagpost(config)`

Creates a flagpost instance for evaluating feature flags.

```ts
import { createFlagpost } from "flagpost";

const fp = createFlagpost({
  flags: {
    myFlag: { defaultValue: true },
  },
  context: async () => ({ userId: getCurrentUserId() }),
});
```

#### `fp.evaluate(name, context?)`

Evaluate a single flag. Returns the resolved value.

```ts
const variant = fp.evaluate("heroVariant", { userId: "user-123" });
```

#### `fp.evaluateAll(context?)`

Evaluate all flags at once. Returns a typed record.

```ts
const all = fp.evaluateAll({ userId: "user-123" });
// { darkMode: false, heroVariant: "experiment", maxItems: 10 }
```

#### `fp.isEnabled(name, context?)`

Shorthand for boolean flags. Returns `true` only if the flag evaluates to `true`.

```ts
if (fp.isEnabled("darkMode")) {
  applyDarkTheme();
}
```

---

### React (`flagpost/react`)

#### `<FlagpostProvider>`

Wraps your app and evaluates all flags on mount.

```tsx
<FlagpostProvider
  flagpost={fp}
  context={async () => ({ userId: user.id })}
>
  {children}
</FlagpostProvider>
```

| Prop | Type | Description |
|------|------|-------------|
| `flagpost` | `Flagpost` | The flagpost instance |
| `context` | `() => FlagContext \| Promise<FlagContext>` | Optional context resolver (overrides config) |

#### `<Flag>`

Conditionally renders children based on a boolean flag.

```tsx
<Flag name="newCheckout" fallback={<OldCheckout />} loading={<Spinner />}>
  <NewCheckout />
</Flag>
```

#### `<FlagSwitch>`

Renders a component based on the evaluated value of a multi-variant flag.

```tsx
<FlagSwitch
  name="pricingPage"
  cases={{
    control: <PricingA />,
    variantB: <PricingB />,
    variantC: <PricingC />,
  }}
  fallback={<PricingA />}
/>
```

#### `useFlag(name)`

Returns the value and status of a single flag.

```ts
const { value, isEnabled, isLoading } = useFlag("darkMode");
```

#### `useFlags()`

Returns all evaluated flags and loading state.

```ts
const { flags, isLoading } = useFlags();
```

#### `useFlagpost()`

Returns the raw flagpost instance.

```ts
const fp = useFlagpost();
```

---

### Server / Next.js (`flagpost/next`)

#### `flag(flagpost, name, context?)`

Evaluate a single flag server-side. Resolves context automatically if not provided.

```ts
const darkMode = await flag(fp, "darkMode");
```

#### `flags(flagpost, context?)`

Evaluate all flags server-side.

```ts
const allFlags = await flags(fp);
```

#### `createFlagMiddleware(flagpost, contextResolver, options?)`

Creates a Next.js middleware that evaluates all flags and injects them as request headers.

```ts
// middleware.ts
import { createFlagMiddleware } from "flagpost/next";
import { fp } from "@/lib/flags";

const withFlags = createFlagMiddleware(fp, (req) => ({
  userId: req.cookies.get("userId")?.value ?? "anonymous",
  country: req.geo?.country ?? "US",
}));

export function middleware(req) {
  return withFlags(req);
}
```

Flags are set as headers with the `x-flag-` prefix. CamelCase names are converted to kebab-case:

| Flag Name | Header |
|-----------|--------|
| `darkMode` | `x-flag-dark-mode` |
| `heroVariant` | `x-flag-hero-variant` |

Read them in Server Components:

```ts
import { headers } from "next/headers";

const hdrs = await headers();
const darkMode = hdrs.get("x-flag-dark-mode") === "true";
```

---

## Targeting & Rollouts

### Percentage Rollout

Roll out a flag to a percentage of users. Requires `userId` in context for deterministic bucketing.

```ts
const fp = createFlagpost({
  flags: {
    newDashboard: {
      defaultValue: false,
      rules: [{ value: true, percentage: 25 }], // 25% of users
    },
  },
});

fp.isEnabled("newDashboard", { userId: "user-42" }); // deterministic
```

### User Targeting

Target specific user attributes with `match`. All keys must match.

```ts
const fp = createFlagpost({
  flags: {
    betaFeature: {
      defaultValue: false,
      rules: [
        { value: true, match: { plan: "enterprise" } },
        { value: true, match: { email: "tester@example.com" } },
      ],
    },
  },
});
```

### Combined Rules

Use `match` and `percentage` together. Both conditions must be satisfied.

```ts
rules: [
  // 50% of enterprise users
  { value: true, match: { plan: "enterprise" }, percentage: 50 },
];
```

Rules are evaluated in order. The first matching rule wins. If no rules match, `defaultValue` is used.

---

## TypeScript

Flag types are fully inferred from your definitions.

```ts
const fp = createFlagpost({
  flags: {
    darkMode: { defaultValue: false },
    tier: { defaultValue: "free" as const },
    maxItems: { defaultValue: 10 },
  },
});

// Type-safe evaluation
const dark: boolean = fp.evaluate("darkMode");
const tier: "free" = fp.evaluate("tier");
const max: number = fp.evaluate("maxItems");

// Type error: "nonexistent" is not a valid flag name
fp.evaluate("nonexistent");
```

Use the helper types for advanced use cases:

```ts
import type { ExtractFlags, ExtractFlagNames } from "flagpost";

type MyFlags = ExtractFlags<typeof fp.definitions>;
// { darkMode: boolean; tier: "free"; maxItems: number }

type MyFlagNames = ExtractFlagNames<typeof fp.definitions>;
// "darkMode" | "tier" | "maxItems"
```

---

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
- **gatehouse** — Drop-in RBAC for Next.js with role hierarchy (`npm i gatehouse`)
