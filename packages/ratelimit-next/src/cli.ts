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

function printHelp() {
  console.log(`
floodgate - Rate limiting for Next.js. Zero dependencies.

Usage:
  floodgate <command>

Commands:
  init    Scaffold a floodgate.config.ts in the current directory
  test    Show instructions for testing rate limits locally
  --help  Show this help message
`);
}

function readPackageJson(cwd: string): Record<string, any> | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function runInit() {
  const cwd = process.cwd();
  const configPath = join(cwd, "floodgate.config.ts");

  if (existsSync(configPath)) {
    console.log("⚠  floodgate.config.ts already exists. Skipping.");
    return;
  }

  const pkg = readPackageJson(cwd);
  const comments: string[] = [];

  if (pkg) {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (!allDeps["ratelimit-next"]) {
      console.log(
        '⚠  "ratelimit-next" is not listed in your package.json dependencies.',
      );
      console.log("   Run: npm install floodgate\n");
    }

    // Detect Vercel-related packages
    if (allDeps["@vercel/kv"] || allDeps["vercel"] || allDeps["@vercel/edge"]) {
      comments.push(
        "// Vercel detected — consider using the edge-compatible store:",
        '// import { vercelKvAdapter } from "ratelimit-next/adapters/vercel-kv";',
      );
    }

    // Detect Redis packages
    if (allDeps["ioredis"] || allDeps["redis"]) {
      comments.push(
        "// Redis detected — consider using the Redis adapter:",
        '// import { redisAdapter } from "ratelimit-next/adapters/redis";',
      );
    }
  } else {
    console.log(
      "⚠  No package.json found in the current directory. Are you in a project root?\n",
    );
  }

  let content = CONFIG_TEMPLATE;
  if (comments.length > 0) {
    content = comments.join("\n") + "\n\n" + content;
  }

  writeFileSync(configPath, content, "utf-8");

  console.log("✔  Created floodgate.config.ts\n");
  console.log("Next steps:");
  console.log("  1. Edit floodgate.config.ts to define your rate-limit rules");
  console.log("  2. Import the limiter in your Next.js middleware or API routes:");
  console.log('     import { limiter } from "./floodgate.config";');
  console.log("  3. See https://github.com/sathergate/floodgate for full docs\n");

  console.log("");
  console.log("  Tip: Pair with gatehouse for authenticated rate limiting → npm i gatehouse");
  console.log("  All packages: gatehouse · shutterbox · flagpost · ratelimit-next · notifykit · croncall · vaultbox · searchcraft");
  console.log("  Toolkit: npm i @sathergate/toolkit");
}

function runTest() {
  console.log(`
Testing rate limits locally
───────────────────────────

1. Start your Next.js dev server:
   npm run dev

2. Send repeated requests to a rate-limited endpoint:
   for i in $(seq 1 70); do
     curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:3000/api/your-endpoint
   done

3. After exceeding the limit you should see 429 responses.

4. To test with different IPs, pass an X-Forwarded-For header:
   curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/api/your-endpoint

5. In development, floodgate uses an in-memory store by default.
   No Redis or external service required.
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "init":
      runInit();
      break;
    case "test":
      runTest();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}

main();
