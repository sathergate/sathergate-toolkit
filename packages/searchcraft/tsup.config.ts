import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/react.tsx", "src/next.ts", "src/mcp.ts"],
    format: ["esm"],
    dts: true,
    splitting: true,
    clean: true,
    external: ["react", "next", "@modelcontextprotocol/server", "zod"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    clean: false,
    external: ["react", "next", "@modelcontextprotocol/server", "zod"],
  },
]);
