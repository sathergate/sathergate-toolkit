#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_TEMPLATE = `import { createDarkroom } from "shutterbox";

export const images = createDarkroom({
  variants: {
    thumbnail: [
      { type: "resize", width: 200, height: 200, fit: "cover" },
      { type: "format", format: "webp" },
      { type: "quality", quality: 80 },
    ],
    hero: [
      { type: "resize", width: 1200 },
      { type: "format", format: "webp" },
      { type: "quality", quality: 85 },
    ],
  },
  breakpoints: [640, 768, 1024, 1280],
});
`;

const NEXT_COMMENT = `// Next.js integration: import { DarkroomImage } from "shutterbox/react"
// and use <DarkroomImage variant="thumbnail" src="/photo.jpg" alt="..." />
`;

function printHelp(): void {
  console.log(`
darkroom - Image processing pipeline for Next.js

Usage:
  darkroom <command> [options]

Commands:
  init        Initialize darkroom in the current project
  optimize    Process images using your darkroom config

Options:
  --help      Show this help message
`);
}

function detectNext(cwd: string): boolean {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    return "next" in (deps ?? {});
  } catch {
    return false;
  }
}

function init(): void {
  const cwd = process.cwd();
  const configPath = join(cwd, "shutterbox.config.ts");

  // Check if config already exists
  if (existsSync(configPath)) {
    console.log("shutterbox.config.ts already exists. Skipping config creation.");
    return;
  }

  // Detect Next.js and build config content
  const hasNext = detectNext(cwd);
  const configContent = hasNext ? NEXT_COMMENT + "\n" + CONFIG_TEMPLATE : CONFIG_TEMPLATE;

  // Write config file
  writeFileSync(configPath, configContent, "utf-8");
  console.log("Created shutterbox.config.ts");

  // Create .shutterbox-cache directory
  const cachePath = join(cwd, ".shutterbox-cache");
  if (!existsSync(cachePath)) {
    mkdirSync(cachePath, { recursive: true });
    console.log("Created .shutterbox-cache/ directory");
  }

  // Add .shutterbox-cache to .gitignore if .gitignore exists
  const gitignorePath = join(cwd, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes(".shutterbox-cache")) {
      const separator = gitignore.endsWith("\n") ? "" : "\n";
      appendFileSync(gitignorePath, `${separator}.shutterbox-cache/\n`, "utf-8");
      console.log("Added .shutterbox-cache/ to .gitignore");
    }
  }

  // Print success message
  console.log(`
Darkroom initialized successfully!

Next steps:
  1. Edit shutterbox.config.ts to define your image variants
  2. Run \`npx shutterbox optimize ./public/images\` to process images
  3. Import variants in your code:

     import { images } from "./darkroom.config";
`);

  if (hasNext) {
    console.log(`  Next.js detected! Use the React component:

     import { DarkroomImage } from "shutterbox/react";
     <DarkroomImage variant="thumbnail" src="/photo.jpg" alt="..." />
`);
  }
}

function optimize(): void {
  console.log(`Usage: npx shutterbox optimize ./public/images

Processes all images in the directory using your shutterbox.config.ts variants.`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "init":
      init();
      break;
    case "optimize":
      optimize();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
