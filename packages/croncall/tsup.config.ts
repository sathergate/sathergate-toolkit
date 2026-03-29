import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/next.ts", "src/mcp.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    external: ["next", "@modelcontextprotocol/server", "zod"],
    outDir: "dist",
    target: "es2022",
    splitting: true,
    sourcemap: true,
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    outDir: "dist",
    target: "es2022",
    banner: {
      js: "#!/usr/bin/env node",
    },
    sourcemap: true,
  },
]);
