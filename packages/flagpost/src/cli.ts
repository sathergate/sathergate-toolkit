import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const CONFIG_FILENAME = "flagpost.config.ts";

function printHelp(): void {
  console.log(`
flagpost - Feature flags for Next.js. One file, full control.

Usage:
  flagpost <command>

Commands:
  init      Create a flagpost.config.ts file in the current directory
  status    Check if flagpost is configured in the current directory

Options:
  --help    Show this help message
`);
}

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function hasDependency(
  pkg: Record<string, unknown>,
  name: string,
): boolean {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name]);
}

function buildConfigTemplate(pkg: Record<string, unknown> | null): string {
  const lines: string[] = [];

  lines.push('import { createFlagpost } from "flagpost";');
  lines.push("");
  lines.push("export const fp = createFlagpost({");
  lines.push("  flags: {");
  lines.push("    // Add your flags here");
  lines.push("    example: {");
  lines.push("      defaultValue: false,");
  lines.push('      description: "An example feature flag",');
  lines.push("    },");
  lines.push("  },");

  if (pkg && hasDependency(pkg, "@clerk/nextjs")) {
    lines.push("  // Clerk detected: consider adding user-targeted rules");
    lines.push("  // e.g. rules: [{ context: { userId: 'user_xxx' }, value: true }]");
  }

  if (pkg && hasDependency(pkg, "vercel")) {
    lines.push("  // Vercel detected: you can use flagpost in Next.js middleware");
    lines.push("  // See https://github.com/sathergate/flagpost#middleware");
  }

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

function commandInit(cwd: string): void {
  const configPath = resolve(cwd, CONFIG_FILENAME);

  if (existsSync(configPath)) {
    console.log(`\u2716 ${CONFIG_FILENAME} already exists at ${configPath}`);
    process.exit(1);
  }

  const pkg = readPackageJson(cwd);

  if (pkg === null) {
    console.log(
      "\u26A0 No package.json found in current directory. Make sure you are in a project root.",
    );
  } else if (!hasDependency(pkg, "flagpost")) {
    console.log(
      '\u26A0 "flagpost" is not listed in your package.json dependencies. Run: npm install flagpost',
    );
  }

  const template = buildConfigTemplate(pkg);
  writeFileSync(configPath, template, "utf-8");

  console.log(`\u2714 Created ${CONFIG_FILENAME}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Open ${CONFIG_FILENAME} and define your flags`);
  console.log("  2. Import { fp } from './flagpost.config' in your app");
  console.log("  3. Use fp.isEnabled('example') to check flags");
}

function commandStatus(cwd: string): void {
  const configPath = resolve(cwd, CONFIG_FILENAME);

  if (existsSync(configPath)) {
    console.log(`\u2714 flagpost configured: ${configPath}`);
  } else {
    console.log(
      `\u2716 No ${CONFIG_FILENAME} found. Run \`npx flagpost init\` to get started.`,
    );
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const cwd = process.cwd();

  switch (command) {
    case "init":
      commandInit(cwd);
      break;
    case "status":
      commandStatus(cwd);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
