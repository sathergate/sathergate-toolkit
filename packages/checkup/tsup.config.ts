import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/mcp.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    clean: true,
    external: ["@modelcontextprotocol/server", "@modelcontextprotocol/server/stdio", "zod"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    clean: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/mcp-stdio.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    clean: false,
    external: ["@modelcontextprotocol/server", "@modelcontextprotocol/server/stdio", "zod"],
  },
]);
