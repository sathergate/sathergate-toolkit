import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const CONFIG_FILENAME = "flagpost.config.ts";

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
    lines.push(
      "  // e.g. rules: [{ context: { userId: 'user_xxx' }, value: true }]",
    );
  }

  if (pkg && hasDependency(pkg, "vercel")) {
    lines.push(
      "  // Vercel detected: you can use flagpost in Next.js middleware",
    );
    lines.push("  // See https://github.com/sathergate/flagpost#middleware");
  }

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

const server = new McpServer({
  name: "flagpost",
  version: "0.1.0",
});

server.tool(
  "flagpost_init",
  "Creates flagpost.config.ts in a project directory. Scaffolds a starter config with an example feature flag.",
  { projectDir: z.string().describe("Absolute path to the project directory") },
  async ({ projectDir }) => {
    const configPath = resolve(projectDir, CONFIG_FILENAME);

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

    const pkg = readPackageJson(projectDir);
    const warnings: string[] = [];

    if (pkg === null) {
      warnings.push(
        "No package.json found in the directory. Make sure you are in a project root.",
      );
    } else if (!hasDependency(pkg, "flagpost")) {
      warnings.push(
        '"flagpost" is not listed in your package.json dependencies. Run: npm install flagpost',
      );
    }

    const template = buildConfigTemplate(pkg);
    writeFileSync(configPath, template, "utf-8");

    const message = [
      `Created ${CONFIG_FILENAME} at ${configPath}`,
      ...warnings.map((w) => `Warning: ${w}`),
      "",
      "Next steps:",
      `  1. Open ${CONFIG_FILENAME} and define your flags`,
      "  2. Import { fp } from './flagpost.config' in your app",
      "  3. Use fp.isEnabled('example') to check flags",
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: message }],
    };
  },
);

server.tool(
  "flagpost_add_flag",
  "Adds a new feature flag definition to an existing flagpost.config.ts file.",
  {
    configPath: z
      .string()
      .describe("Absolute path to the flagpost.config.ts file"),
    name: z.string().describe("Name of the flag to add"),
    defaultValue: z
      .union([z.boolean(), z.string(), z.number()])
      .describe("Default value for the flag"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the flag"),
  },
  async ({ configPath, name, defaultValue, description }) => {
    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Config file not found at ${configPath}. Run flagpost_init first.`,
          },
        ],
      };
    }

    const content = readFileSync(configPath, "utf-8");

    const formattedValue =
      typeof defaultValue === "string"
        ? `"${defaultValue}"`
        : String(defaultValue);

    let flagBlock = `    ${name}: {\n      defaultValue: ${formattedValue},\n`;
    if (description) {
      flagBlock += `      description: "${description}",\n`;
    }
    flagBlock += `    },`;

    // Insert the new flag before the closing `},` of the flags object.
    // Look for the pattern where the flags object closes.
    const flagsClosePattern = /^(\s*)\},\s*$/m;
    const lines = content.split("\n");
    let insertIndex = -1;

    // Find the `flags: {` line, then find its closing `},`
    let inFlags = false;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("flags:") && lines[i].includes("{")) {
        inFlags = true;
        braceDepth = 1;
        continue;
      }
      if (inFlags) {
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
            text: "Could not find the flags object in the config file. Please add the flag manually.",
          },
        ],
      };
    }

    lines.splice(insertIndex, 0, flagBlock);
    writeFileSync(configPath, lines.join("\n"), "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `Added flag "${name}" with defaultValue ${formattedValue} to ${configPath}`,
        },
      ],
    };
  },
);

server.tool(
  "flagpost_list_flags",
  "Lists all feature flags defined in a flagpost.config.ts file, showing their names and default values.",
  {
    configPath: z
      .string()
      .describe("Absolute path to the flagpost.config.ts file"),
  },
  async ({ configPath }) => {
    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Config file not found at ${configPath}.`,
          },
        ],
      };
    }

    const content = readFileSync(configPath, "utf-8");

    // Extract flag names and default values using regex
    const flagPattern =
      /(\w+)\s*:\s*\{[^}]*defaultValue\s*:\s*(true|false|"[^"]*"|\d+(?:\.\d+)?)/g;
    const flags: Array<{ name: string; defaultValue: string }> = [];
    let match;

    while ((match = flagPattern.exec(content)) !== null) {
      flags.push({ name: match[1], defaultValue: match[2] });
    }

    if (flags.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No flags found in the config file.",
          },
        ],
      };
    }

    const flagList = flags
      .map((f) => `  - ${f.name}: ${f.defaultValue}`)
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Flags in ${configPath}:\n${flagList}`,
        },
      ],
    };
  },
);

export { server };
