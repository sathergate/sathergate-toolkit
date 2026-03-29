import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CONFIG_TEMPLATE = `import { createFloodgate } from "ratelimit-next";

export const limiter = createFloodgate({
  rules: {
    api: { limit: 60, window: "1m" },
    auth: { limit: 5, window: "15m" },
  },
});
`;

function readPackageJson(cwd: string): Record<string, any> | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

const server = new McpServer({
  name: "floodgate",
  version: "0.1.0",
});

server.tool(
  "floodgate_init",
  "Creates floodgate.config.ts in a project directory. Scaffolds a starter config with default rate limit rules for API and auth endpoints.",
  { projectDir: z.string().describe("Absolute path to the project directory") },
  async ({ projectDir }) => {
    const configPath = join(projectDir, "floodgate.config.ts");

    if (existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "floodgate.config.ts already exists. Skipping.",
          },
        ],
      };
    }

    const pkg = readPackageJson(projectDir);
    const warnings: string[] = [];
    const comments: string[] = [];

    if (pkg) {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      } as Record<string, string>;

      if (!allDeps["ratelimit-next"]) {
        warnings.push(
          '"ratelimit-next" is not listed in your package.json dependencies. Run: npm install ratelimit-next',
        );
      }

      if (
        allDeps["@vercel/kv"] ||
        allDeps["vercel"] ||
        allDeps["@vercel/edge"]
      ) {
        comments.push(
          "// Vercel detected — consider using the edge-compatible store:",
          '// import { vercelKvAdapter } from "ratelimit-next/adapters/vercel-kv";',
        );
      }

      if (allDeps["ioredis"] || allDeps["redis"]) {
        comments.push(
          "// Redis detected — consider using the Redis adapter:",
          '// import { redisAdapter } from "ratelimit-next/adapters/redis";',
        );
      }
    } else {
      warnings.push(
        "No package.json found in the directory. Are you in a project root?",
      );
    }

    let content = CONFIG_TEMPLATE;
    if (comments.length > 0) {
      content = comments.join("\n") + "\n\n" + content;
    }

    writeFileSync(configPath, content, "utf-8");

    const message = [
      `Created floodgate.config.ts at ${configPath}`,
      ...warnings.map((w) => `Warning: ${w}`),
      "",
      "Next steps:",
      "  1. Edit floodgate.config.ts to define your rate-limit rules",
      "  2. Import the limiter in your Next.js middleware or API routes:",
      '     import { limiter } from "./floodgate.config";',
      "  3. See https://github.com/sathergate/floodgate for full docs",
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: message }],
    };
  },
);

server.tool(
  "floodgate_add_rule",
  "Adds a new rate limit rule to an existing floodgate.config.ts file.",
  {
    configPath: z
      .string()
      .describe("Absolute path to the floodgate.config.ts file"),
    name: z.string().describe("Name of the rate limit rule (e.g. 'api', 'auth', 'upload')"),
    limit: z.number().describe("Maximum number of requests allowed in the window"),
    window: z.string().describe('Time window (e.g. "1m", "15m", "1h")'),
    algorithm: z
      .string()
      .optional()
      .describe('Rate limiting algorithm: "sliding-window" or "token-bucket"'),
  },
  async ({ configPath, name, limit, window, algorithm }) => {
    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Config file not found at ${configPath}. Run floodgate_init first.`,
          },
        ],
      };
    }

    const content = readFileSync(configPath, "utf-8");

    let ruleBlock = `    ${name}: { limit: ${limit}, window: "${window}"`;
    if (algorithm) {
      ruleBlock += `, algorithm: "${algorithm}"`;
    }
    ruleBlock += ` },`;

    // Find the `rules: {` line, then find its closing `},`
    const lines = content.split("\n");
    let insertIndex = -1;
    let inRules = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("rules:") && lines[i].includes("{")) {
        inRules = true;
        braceDepth = 1;
        continue;
      }
      if (inRules) {
        for (const ch of lines[i]) {
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        if (braceDepth === 0) {
          insertIndex = i;
          break;
        }
      }
    }

    if (insertIndex === -1) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Could not find the rules object in the config file. Please add the rule manually.",
          },
        ],
      };
    }

    lines.splice(insertIndex, 0, ruleBlock);
    writeFileSync(configPath, lines.join("\n"), "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `Added rule "${name}" (limit: ${limit}, window: "${window}"${algorithm ? `, algorithm: "${algorithm}"` : ""}) to ${configPath}`,
        },
      ],
    };
  },
);

server.tool(
  "floodgate_test",
  "Returns instructions for testing a specific rate limit rule locally.",
  {
    rule: z
      .string()
      .describe('Name of the rate limit rule to test (e.g. "api", "auth")'),
  },
  async ({ rule }) => {
    const instructions = `Testing rate limit rule "${rule}" locally
───────────────────────────────────────

1. Start your Next.js dev server:
   npm run dev

2. Send repeated requests to a rate-limited endpoint:
   for i in $(seq 1 70); do
     curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:3000/api/your-endpoint
   done

3. After exceeding the limit for the "${rule}" rule, you should see 429 responses.

4. To test with different IPs, pass an X-Forwarded-For header:
   curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/api/your-endpoint

5. In development, floodgate uses an in-memory store by default.
   No Redis or external service required.

6. To verify the "${rule}" rule specifically, make sure your route or middleware
   references it:
   import { rateLimit } from "ratelimit-next/next";
   await rateLimit(limiter, "${rule}");`;

    return {
      content: [{ type: "text" as const, text: instructions }],
    };
  },
);

export { server };
