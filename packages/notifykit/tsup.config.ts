import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: [
      "src/index.ts",
      "src/react.tsx",
      "src/next.ts",
      "src/adapters/twilio.ts",
      "src/adapters/sns.ts",
      "src/adapters/resend.ts",
      "src/mcp.ts",
    ],
    format: ["esm"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: ["react", "next", "twilio", "@aws-sdk/client-sns", "resend", "@modelcontextprotocol/server", "zod"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    sourcemap: true,
    clean: false,
    external: ["react", "next", "twilio", "@aws-sdk/client-sns", "resend", "@modelcontextprotocol/server", "zod"],
  },
]);
