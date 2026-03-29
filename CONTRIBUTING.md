# Contributing to sathergate-toolkit

Thanks for your interest in contributing! This guide covers setup, conventions, and how to submit changes.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/sathergate/sathergate-toolkit.git
cd sathergate-toolkit

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Type-check
npm run typecheck
```

## Repo Structure

```
sathergate-toolkit/
├── packages/
│   ├── croncall/        # Cron jobs for Next.js
│   ├── flagpost/        # Feature flags
│   ├── notifykit/       # Unified notifications
│   ├── ratelimit-next/  # Rate limiting
│   ├── searchcraft/     # Full-text search
│   ├── shutterbox/      # Image processing pipeline
│   ├── vaultbox/        # Encrypted secrets
│   ├── toolkit/         # Meta-package (@sathergate/toolkit)
│   └── website/         # Marketing site
├── examples/
│   └── kitchen-sink/    # Example app using multiple packages
├── tests/               # Cross-package eval and integration tests
└── stubs/               # Peer dependency stubs for development
```

## Package Conventions

Each package follows the same structure:

- **TypeScript ES2022, ESM-only** — all packages use `tsup` for builds
- **Zero runtime dependencies** — only peer dependencies where needed
- **MCP support** — every package includes a `server.json` and `./mcp` export
- **CLAUDE.md** — agent-friendly instructions in every package

## Working on a Package

```bash
# Build a single package
npx turbo run build --filter=flagpost

# Watch mode
cd packages/flagpost && npm run dev

# Run tests for a specific package
npx vitest run packages/flagpost
```

## Adding Tests

Tests live in `src/__tests__/` within each package:

```bash
packages/flagpost/src/__tests__/core.test.ts
```

We use [Vitest](https://vitest.dev/) for all tests. Run with:

```bash
npm run test              # All tests
npx vitest run packages/  # Package tests only
npx vitest run tests/     # Eval/integration tests only
```

## Pull Request Process

1. Create a branch from `main`
2. Make your changes with clear commit messages
3. Ensure `npm run build` and `npm run test` pass
4. Ensure `npm run typecheck` passes
5. Open a PR with a clear description of what and why

## Code Style

- No linter/formatter is enforced yet — just match the existing style
- Prefer explicit types at API boundaries
- Keep exports minimal — only export what users need
- Error messages should be actionable (tell the user what to do to fix it)

## Reporting Issues

Use the [issue templates](https://github.com/sathergate/sathergate-toolkit/issues/new/choose) for bug reports and feature requests.
