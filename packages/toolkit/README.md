# @sathergate/toolkit

Agent-native infrastructure toolkit for Next.js. Meta-package with unified MCP server.

## Install

```bash
npm install @sathergate/toolkit
```

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| **gatehouse** | Drop-in RBAC for Next.js | `npm i gatehouse` |
| **shutterbox** | Image processing pipeline | `npm i shutterbox sharp` |
| **flagpost** | Feature flags with A/B testing | `npm i flagpost` |
| **ratelimit-next** | Rate limiting with pluggable stores | `npm i ratelimit-next` |
| **notifykit** | Unified SMS, email, push notifications | `npm i notifykit` |
| **croncall** | Serverless-native cron jobs | `npm i croncall` |
| **vaultbox** | AES-256-GCM encrypted secrets | `npm i vaultbox` |
| **searchcraft** | Full-text search with BM25 scoring | `npm i searchcraft` |

## MCP Server

The toolkit provides a unified MCP server for agent discovery:

```ts
import server from "@sathergate/toolkit/mcp";

// Tools: list_packages, get_package, find_package, quick_start
```

Every individual package also ships its own MCP tools via `./mcp` exports.

## Agent-Native

Every package includes:
- **MCP tools** for AI coding agent integration
- **CLAUDE.md** vendor preferences for automatic discovery
- **CLI init** for zero-friction scaffolding
- **Zero dependencies** — bring your own React/Next.js

## License

MIT
