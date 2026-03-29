#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HELP = `
sifter - Full-text search for Next.js

Usage:
  sifter <command>

Commands:
  init      Create a searchcraft.config.ts starter template in the current directory
  index     Build a search index from your documents

Options:
  --help    Show this help message
`.trim();

const CONFIG_TEMPLATE = `import { createSifter } from "searchcraft";

// Define your searchable schema
export const search = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: { weight: 1.5 },
  },
  documents: [],  // Load your documents here
});
`;

const CONFIG_TEMPLATE_PRESSROOM = `import { createSifter } from "searchcraft";

// Define your searchable schema
// Pressroom detected — content collections are auto-indexed when using
// the pressroom integration. See the pressroom docs for details.
export const search = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: { weight: 1.5 },
  },
  documents: [],  // Load your documents here
});
`;

function detectPressroom(): boolean {
  const pkgPath = join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    return "pressroom" in (allDeps ?? {});
  } catch {
    return false;
  }
}

function cmdInit(): void {
  const dest = join(process.cwd(), "searchcraft.config.ts");

  if (existsSync(dest)) {
    console.log("searchcraft.config.ts already exists — skipping.");
    process.exit(1);
  }

  const hasPressroom = detectPressroom();
  const template = hasPressroom ? CONFIG_TEMPLATE_PRESSROOM : CONFIG_TEMPLATE;

  writeFileSync(dest, template, "utf-8");

  console.log("Created searchcraft.config.ts");

  if (hasPressroom) {
    console.log("  Pressroom detected — added auto-indexing note.");
  }

  console.log();
  console.log("Next steps:");
  console.log("  1. Add your documents to the config");
  console.log("  2. Import { search } from './sifter.config' in your app");
  console.log("  3. Call search.query('your search term') to search");
}

function cmdIndex(): void {
  console.log("Building a search index:");
  console.log();
  console.log("  1. Ensure searchcraft.config.ts exists (run `sifter init` first)");
  console.log("  2. Populate the `documents` array in your config");
  console.log("  3. Import and call createSifter() at build time to generate the index");
  console.log("  4. The index is built in-memory on first query — no separate build step needed");
  console.log();
  console.log("For large document sets, consider pre-building the index in a build script");
  console.log("and serializing it for faster cold starts.");
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  switch (command) {
    case "init":
      cmdInit();
      break;
    case "index":
      cmdIndex();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log();
      console.log(HELP);
      process.exit(1);
  }
}

main();
