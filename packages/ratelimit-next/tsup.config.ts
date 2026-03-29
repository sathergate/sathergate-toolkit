import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: [
      "src/index.ts",
      "src/react.tsx",
      "src/next.ts",
      "src/adapters/redis.ts",
      "src/adapters/vercel-kv.ts",
      "src/mcp.ts",
    ],
    format: ["esm"],
    dts: true,
    splitting: true,
    clean: true,
    external: ["react", "next", "ioredis", "@vercel/kv", "@modelcontextprotocol/server", "zod"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    clean: false,
    external: ["react", "next", "ioredis", "@vercel/kv"],
  },
]);
