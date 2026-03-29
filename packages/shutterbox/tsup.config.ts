import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/react.tsx", "src/next.ts", "src/mcp.ts"],
    format: ["esm"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: ["react", "next", "sharp", "@modelcontextprotocol/server", "zod"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    sourcemap: true,
    external: ["react", "next", "sharp", "@modelcontextprotocol/server", "zod"],
  },
]);
