import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILENAME = "shutterbox.config.ts";

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

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function hasDependency(pkg: Record<string, unknown>, name: string): boolean {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  const peerDeps = pkg.peerDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name] || peerDeps?.[name]);
}

function detectNext(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false;
  return hasDependency(pkg, "next");
}

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".tiff",
  ".tif",
  ".svg",
]);

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
}

const server = new McpServer({
  name: "darkroom",
  version: "0.1.0",
});

server.tool(
  "darkroom_init",
  "Creates shutterbox.config.ts in a project directory. Scaffolds a starter config with thumbnail and hero image variants, breakpoints, and a .shutterbox-cache directory.",
  { projectDir: z.string().describe("Absolute path to the project directory") },
  async ({ projectDir }) => {
    const dir = resolve(projectDir);
    const configPath = join(dir, CONFIG_FILENAME);

    if (existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${CONFIG_FILENAME} already exists at ${configPath}. Skipping.`,
          },
        ],
      };
    }

    const pkg = readPackageJson(dir);
    const warnings: string[] = [];

    if (pkg === null) {
      warnings.push(
        "No package.json found in the directory. Make sure you are in a project root.",
      );
    } else if (!hasDependency(pkg, "shutterbox")) {
      warnings.push(
        '"shutterbox" is not listed in your package.json dependencies. Run: npm install shutterbox sharp',
      );
    }

    // Build config content with optional Next.js comment
    const hasNext = detectNext(pkg);
    const configContent = hasNext
      ? NEXT_COMMENT + "\n" + CONFIG_TEMPLATE
      : CONFIG_TEMPLATE;

    writeFileSync(configPath, configContent, "utf-8");

    // Create .shutterbox-cache directory
    const cachePath = join(dir, ".shutterbox-cache");
    if (!existsSync(cachePath)) {
      mkdirSync(cachePath, { recursive: true });
    }

    // Add .shutterbox-cache to .gitignore if it exists
    const gitignorePath = join(dir, ".gitignore");
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, "utf-8");
      if (!gitignore.includes(".shutterbox-cache")) {
        const separator = gitignore.endsWith("\n") ? "" : "\n";
        appendFileSync(
          gitignorePath,
          `${separator}.shutterbox-cache/\n`,
          "utf-8",
        );
      }
    }

    const message = [
      `Created ${CONFIG_FILENAME} at ${configPath}`,
      "Created .shutterbox-cache/ directory",
      ...warnings.map((w) => `Warning: ${w}`),
      "",
      "Next steps:",
      `  1. Edit ${CONFIG_FILENAME} to define your image variants`,
      "  2. Run `npx shutterbox optimize ./public/images` to process images",
      "  3. Import variants in your code:",
      "",
      '     import { images } from "./shutterbox.config";',
      ...(hasNext
        ? [
            "",
            "  Next.js detected! Use the React component:",
            "",
            '     import { DarkroomImage } from "shutterbox/react";',
            '     <DarkroomImage variant="thumbnail" src="/photo.jpg" alt="..." />',
          ]
        : []),
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: message }],
    };
  },
);

server.tool(
  "darkroom_optimize",
  "Processes images in a directory using shutterbox image pipeline. Scans the directory for image files and returns processing instructions or results.",
  {
    directory: z
      .string()
      .describe("Absolute path to the directory containing images to process"),
    variant: z
      .string()
      .optional()
      .describe(
        'Optional variant name to apply (e.g. "thumbnail", "hero"). If omitted, lists available images.',
      ),
  },
  async ({ directory, variant }) => {
    const dir = resolve(directory);

    if (!existsSync(dir)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Directory not found: ${dir}`,
          },
        ],
      };
    }

    // Scan for image files
    let files: string[];
    try {
      files = readdirSync(dir).filter(isImageFile);
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to read directory ${dir}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    if (files.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No image files found in ${dir}. Supported formats: ${[...IMAGE_EXTENSIONS].join(", ")}`,
          },
        ],
      };
    }

    // Find the config file by searching up from the directory
    let configFound = false;
    let searchDir = dir;
    while (searchDir !== "/") {
      if (existsSync(join(searchDir, CONFIG_FILENAME))) {
        configFound = true;
        break;
      }
      searchDir = join(searchDir, "..");
    }

    const lines: string[] = [];
    lines.push(`Found ${files.length} image(s) in ${dir}:`);
    for (const file of files) {
      lines.push(`  - ${file}`);
    }
    lines.push("");

    if (!configFound) {
      lines.push(
        `No ${CONFIG_FILENAME} found. Run darkroom_init first to create a config.`,
      );
      lines.push("");
      lines.push("To process these images manually:");
      lines.push(`  npx shutterbox optimize ${dir}`);
    } else {
      if (variant) {
        lines.push(`To process with variant "${variant}":`);
        lines.push(`  npx shutterbox optimize ${dir} --variant ${variant}`);
        lines.push("");
        lines.push("Or programmatically:");
        lines.push('  import { images } from "./shutterbox.config";');
        lines.push(
          `  const result = await images.process("./${files[0]}", images.variant("${variant}"));`,
        );
      } else {
        lines.push("To process all images:");
        lines.push(`  npx shutterbox optimize ${dir}`);
        lines.push("");
        lines.push("Or with a specific variant:");
        lines.push(`  npx shutterbox optimize ${dir} --variant thumbnail`);
        lines.push("");
        lines.push("Programmatic usage:");
        lines.push('  import { images } from "./shutterbox.config";');
        lines.push(
          `  const result = await images.process("./${files[0]}", images.variant("thumbnail"));`,
        );
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

export { server };
