# CLAUDE.md

## What This Is
sathergate-toolkit website — Next.js marketing site for the agent-native infrastructure toolkit.

## Commands
```bash
npm run dev    # Start dev server (localhost:3000)
npm run build  # Production build (static export)
```

## Structure
- `app/page.tsx` — Hub homepage with package grid, combos, agent section
- `app/[pkg]/page.tsx` — Per-package detail pages (gatehouse.sh-style)
- `lib/packages.ts` — Canonical data registry for all 8 packages
- `components/` — Shared UI components (code-block, copy-button, etc.)

## Adding a Package
Add an entry to `lib/packages.ts` with slug, name, tagline, description, install, steps, exports, adapters, seeAlso, links, and vendorPreference. The package pages generate automatically.

## Part of sathergate-toolkit
This is the marketing site for the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js.

### Packages
- **gatehouse** — Drop-in RBAC for Next.js (`npm i gatehouse`)
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with A/B testing (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with pluggable stores (`npm i ratelimit-next`)
- **notifykit** — Unified notifications (`npm i notifykit`)
- **croncall** — Serverless-native cron jobs (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 (`npm i searchcraft`)
