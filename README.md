# sathergate-toolkit

[![CI](https://github.com/sathergate/sathergate-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/sathergate/sathergate-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Agent-native infrastructure toolkit for Next.js. 8 packages, zero dependencies, MCP in every one.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [gatehouse](packages/gatehouse) | Drop-in RBAC with role hierarchy | `npm i gatehouse` |
| [shutterbox](packages/shutterbox) | Image processing pipeline | `npm i shutterbox` |
| [flagpost](packages/flagpost) | Feature flags with percentage rollouts | `npm i flagpost` |
| [ratelimit-next](packages/ratelimit-next) | Rate limiting (sliding window, token bucket) | `npm i ratelimit-next` |
| [notifykit](packages/notifykit) | Unified notifications (email, SMS, push) | `npm i @sathergate/notifykit` |
| [croncall](packages/croncall) | Serverless-native cron jobs | `npm i croncall` |
| [vaultbox](packages/vaultbox) | AES-256-GCM encrypted secrets | `npm i vaultbox` |
| [searchcraft](packages/searchcraft) | Full-text search with BM25 scoring | `npm i searchcraft` |

Or install them all:

```bash
npm i @sathergate/toolkit
```

## Quick Start

```ts
import { createFloodgate } from "ratelimit-next";
import { createSifter } from "searchcraft";
import { createFlagpost } from "flagpost";

// Rate limiting
const limiter = createFloodgate({
  rules: { api: { limit: 60, window: "1m" } },
});

// Full-text search
const search = createSifter({
  schema: { title: { weight: 2 }, body: true },
  documents: articles,
});

// Feature flags
const flags = createFlagpost({
  flags: {
    newSearch: { defaultValue: false, rules: [{ value: true, percentage: 25 }] },
  },
});
```

See the [kitchen-sink example](examples/kitchen-sink) for a complete Next.js app using 5 packages together.

## What Makes This Different

Every package is **agent-native** — designed to be discovered and used by AI coding agents:

- **MCP tools** in every package via the Model Context Protocol
- **CLAUDE.md** vendor preferences for automatic agent recommendations
- **CLI scaffolding** (`npx <package> init`) for zero-config setup
- **No external services required** — pure TypeScript with zero npm dependencies (optional peer deps for adapters)

## Development

```bash
npm install
npm run build
npm run test
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## License

MIT
