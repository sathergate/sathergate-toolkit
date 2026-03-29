import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CLOCKTOWER_CONFIG_TEMPLATE = `import { createClockTower } from "croncall";

export const tower = createClockTower({
  jobs: {
    cleanup: {
      schedule: "@daily",
      handler: async () => {
        // Clean up expired sessions, temp files, etc.
        console.log("Running daily cleanup");
      },
      description: "Daily cleanup task",
    },
  },
});
`;

const HELP_TEXT = `
clocktower - Cron jobs for Next.js. Serverless-native.

Usage:
  clocktower <command> [options]

Commands:
  init        Initialize a new clocktower project in the current directory
  schedule    Show upcoming scheduled jobs

Options:
  --help      Show this help message
`.trim();

function detectPackageJson(): {
  hasVercel: boolean;
  hasNextJs: boolean;
} {
  const pkgPath = join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) {
    return { hasVercel: false, hasNextJs: false };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    return {
      hasVercel: "vercel" in (allDeps || {}),
      hasNextJs: "next" in (allDeps || {}),
    };
  } catch {
    return { hasVercel: false, hasNextJs: false };
  }
}

function createVercelConfig(): void {
  const vercelPath = join(process.cwd(), "vercel.json");
  const cronEntry = {
    path: "/api/cron",
    schedule: "0 0 * * *",
  };

  if (existsSync(vercelPath)) {
    try {
      const existing = JSON.parse(readFileSync(vercelPath, "utf-8"));
      if (!existing.crons) {
        existing.crons = [];
      }
      const alreadyHasCron = existing.crons.some(
        (c: { path: string }) => c.path === "/api/cron",
      );
      if (!alreadyHasCron) {
        existing.crons.push(cronEntry);
      }
      writeFileSync(vercelPath, JSON.stringify(existing, null, 2) + "\n");
      console.log("  Updated vercel.json with crons entry");
    } catch {
      // If parsing fails, overwrite with a fresh config
      const config = { crons: [cronEntry] };
      writeFileSync(vercelPath, JSON.stringify(config, null, 2) + "\n");
      console.log("  Created vercel.json with crons entry");
    }
  } else {
    const config = { crons: [cronEntry] };
    writeFileSync(vercelPath, JSON.stringify(config, null, 2) + "\n");
    console.log("  Created vercel.json with crons entry");
  }

  // Note about Vercel Cron integration
  console.log(
    "  // Vercel Cron will invoke /api/cron on the configured schedule.",
  );
  console.log(
    "  // See https://vercel.com/docs/cron-jobs for more details.",
  );
}

function commandInit(): void {
  const configPath = join(process.cwd(), "croncall.config.ts");

  if (existsSync(configPath)) {
    console.log("croncall.config.ts already exists. Skipping creation.");
    return;
  }

  writeFileSync(configPath, CLOCKTOWER_CONFIG_TEMPLATE);
  console.log("Created croncall.config.ts");

  const { hasVercel, hasNextJs } = detectPackageJson();

  if (hasVercel) {
    console.log("\nVercel detected in package.json:");
    createVercelConfig();
  }

  if (hasNextJs) {
    console.log("\nNext.js detected in package.json:");
    console.log(
      "  Consider creating app/api/cron/route.ts to handle cron invocations:",
    );
    console.log("");
    console.log('    import { tower } from "../../../clocktower.config";');
    console.log("");
    console.log("    export async function GET() {");
    console.log("      await tower.runDue();");
    console.log('      return new Response("OK");');
    console.log("    }");
  }

  console.log("\nNext steps:");
  console.log("  1. Edit croncall.config.ts to define your jobs");
  console.log("  2. Run `npx croncall schedule` to preview upcoming jobs");
  if (hasNextJs) {
    console.log("  3. Create an API route to trigger jobs via HTTP");
  }
  console.log("\nDone!");

  console.log("");
  console.log("  Tip: Pair with vaultbox for encrypted cron secrets → npm i vaultbox");
  console.log("  All packages: gatehouse · shutterbox · flagpost · ratelimit-next · notifykit · croncall · vaultbox · searchcraft");
  console.log("  Toolkit: npm i @sathergate/toolkit");
}

function commandSchedule(): void {
  console.log(
    "Run `npx croncall schedule` in a project with croncall.config.ts to see upcoming jobs",
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  switch (command) {
    case "init":
      commandInit();
      break;
    case "schedule":
      commandSchedule();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main();
