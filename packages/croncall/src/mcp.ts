import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseCron, nextRun } from "./core/cron.js";

// ---------------------------------------------------------------------------
// Config template (shared with cli.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedJob {
  name: string;
  schedule: string;
  description?: string;
}

/**
 * Parse job definitions from a clocktower/croncall config file.
 * This does a best-effort regex-based extraction from the TypeScript source,
 * since we cannot dynamically import configs that contain handler functions.
 */
function parseJobsFromConfig(configPath: string): ParsedJob[] {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const source = readFileSync(configPath, "utf8");
  const jobs: ParsedJob[] = [];

  // Match job entries like:  jobName: { schedule: "...", ... }
  // We use a regex that captures the job name and then looks for schedule/description fields
  const jobBlockRegex =
    /(\w+)\s*:\s*\{[^}]*?schedule\s*:\s*["']([^"']+)["'][^}]*?\}/gs;
  let match: RegExpExecArray | null;

  while ((match = jobBlockRegex.exec(source)) !== null) {
    const name = match[1];
    const schedule = match[2];

    // Try to extract description
    const block = match[0];
    const descMatch = block.match(/description\s*:\s*["']([^"']+)["']/);
    const description = descMatch ? descMatch[1] : undefined;

    jobs.push({ name, schedule, description });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export const server = new McpServer({
  name: "clocktower",
  version: "0.1.0",
});

// --- clocktower_init --------------------------------------------------------

server.tool(
  "clocktower_init",
  "Scaffold a croncall.config.ts file in the target project directory.",
  {
    projectDir: z.string().describe("Absolute path to the project directory"),
  },
  async ({ projectDir }) => {
    const configPath = join(projectDir, "croncall.config.ts");
    const messages: string[] = [];

    if (existsSync(configPath)) {
      return {
        content: [
          {
            type: "text",
            text: "croncall.config.ts already exists. Skipping creation.",
          },
        ],
      };
    }

    writeFileSync(configPath, CLOCKTOWER_CONFIG_TEMPLATE);
    messages.push("Created croncall.config.ts");

    // Detect ecosystem
    const pkgPath = join(projectDir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        if ("vercel" in (allDeps || {})) {
          // Create/update vercel.json with cron entry
          const vercelPath = join(projectDir, "vercel.json");
          const cronEntry = { path: "/api/cron", schedule: "0 0 * * *" };

          if (existsSync(vercelPath)) {
            try {
              const existing = JSON.parse(
                readFileSync(vercelPath, "utf-8"),
              );
              if (!existing.crons) existing.crons = [];
              const alreadyHas = existing.crons.some(
                (c: { path: string }) => c.path === "/api/cron",
              );
              if (!alreadyHas) existing.crons.push(cronEntry);
              writeFileSync(
                vercelPath,
                JSON.stringify(existing, null, 2) + "\n",
              );
              messages.push("Updated vercel.json with crons entry");
            } catch {
              writeFileSync(
                vercelPath,
                JSON.stringify({ crons: [cronEntry] }, null, 2) + "\n",
              );
              messages.push("Created vercel.json with crons entry");
            }
          } else {
            writeFileSync(
              vercelPath,
              JSON.stringify({ crons: [cronEntry] }, null, 2) + "\n",
            );
            messages.push("Created vercel.json with crons entry");
          }
        }

        if ("next" in (allDeps || {})) {
          messages.push("");
          messages.push("Next.js detected. Create app/api/cron/route.ts:");
          messages.push('  import { tower } from "../../../clocktower.config";');
          messages.push("  export async function GET() {");
          messages.push("    await tower.runDue();");
          messages.push('    return new Response("OK");');
          messages.push("  }");
        }
      } catch {
        // Malformed package.json — skip ecosystem detection
      }
    }

    messages.push("");
    messages.push("Next steps:");
    messages.push("  1. Edit croncall.config.ts to define your jobs");
    messages.push(
      "  2. Use clocktower_add_job to add jobs, or clocktower_schedule to preview",
    );

    return {
      content: [{ type: "text", text: messages.join("\n") }],
    };
  },
);

// --- clocktower_add_job -----------------------------------------------------

server.tool(
  "clocktower_add_job",
  "Add a job definition to an existing croncall config file.",
  {
    configPath: z
      .string()
      .describe("Absolute path to the croncall.config.ts file"),
    name: z
      .string()
      .describe("Job name (valid JS identifier, e.g. 'syncUsers')"),
    schedule: z
      .string()
      .describe(
        'Cron expression (e.g. "0 * * * *") or shortcut ("@daily", "@hourly")',
      ),
    description: z
      .string()
      .optional()
      .describe("Human-readable description of what the job does"),
  },
  async ({ configPath, name, schedule, description }) => {
    // Validate the cron expression
    try {
      parseCron(schedule);
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid cron expression "${schedule}": ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }

    if (!existsSync(configPath)) {
      return {
        content: [
          {
            type: "text",
            text: `Config file not found: ${configPath}. Run clocktower_init first.`,
          },
        ],
        isError: true,
      };
    }

    const source = readFileSync(configPath, "utf8");

    // Build the job entry
    const descLine = description
      ? `\n      description: "${description}",`
      : "";
    const jobEntry = `    ${name}: {
      schedule: "${schedule}",
      handler: async () => {
        // TODO: implement ${name}
        console.log("Running ${name}");
      },${descLine}
    },`;

    // Find the closing of the jobs object to insert before it.
    // We look for the pattern "jobs: {" and then find the matching closing brace.
    // A simpler approach: insert the new job just before the last job's closing "},\n  },"
    // or before "  },\n});"
    //
    // Strategy: find the last occurrence of a job block closing and insert after it.
    // We look for the pattern:  "    },\n" followed by "  },\n" (end of jobs object).

    // Find the closing of the jobs object: look for "\n  }," or "\n  }\n" after "jobs: {"
    const jobsStart = source.indexOf("jobs: {");
    if (jobsStart === -1) {
      return {
        content: [
          {
            type: "text",
            text: `Could not find "jobs: {" in ${configPath}. Ensure the config uses createClockTower({ jobs: { ... } }).`,
          },
        ],
        isError: true,
      };
    }

    // Find the closing brace of the jobs object by counting braces
    let depth = 0;
    let jobsObjStart = -1;
    let jobsObjEnd = -1;

    for (let i = jobsStart + "jobs: ".length; i < source.length; i++) {
      if (source[i] === "{") {
        if (depth === 0) jobsObjStart = i;
        depth++;
      } else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          jobsObjEnd = i;
          break;
        }
      }
    }

    if (jobsObjEnd === -1) {
      return {
        content: [
          {
            type: "text",
            text: "Could not parse the jobs object boundaries in the config file.",
          },
        ],
        isError: true,
      };
    }

    // Insert the new job just before the closing brace of the jobs object
    const before = source.slice(0, jobsObjEnd);
    const after = source.slice(jobsObjEnd);

    const needsNewline = !before.endsWith("\n");
    const updated = before + (needsNewline ? "\n" : "") + jobEntry + "\n" + after;

    writeFileSync(configPath, updated);

    const next = nextRun(schedule);
    return {
      content: [
        {
          type: "text",
          text: `Added job "${name}" with schedule "${schedule}" to ${configPath}.\nNext run: ${next.toISOString()}`,
        },
      ],
    };
  },
);

// --- clocktower_schedule ----------------------------------------------------

server.tool(
  "clocktower_schedule",
  "List upcoming job runs parsed from a croncall config file.",
  {
    configPath: z
      .string()
      .describe("Absolute path to the croncall.config.ts file"),
  },
  async ({ configPath }) => {
    let jobs: ParsedJob[];
    try {
      jobs = parseJobsFromConfig(configPath);
    } catch (err) {
      return {
        content: [
          { type: "text", text: (err as Error).message },
        ],
        isError: true,
      };
    }

    if (jobs.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No jobs found in ${configPath}. Add jobs using clocktower_add_job.`,
          },
        ],
      };
    }

    const now = new Date();
    const lines = jobs.map((job) => {
      try {
        const next = nextRun(job.schedule, now);
        const desc = job.description ? ` — ${job.description}` : "";
        return `  ${job.name}: ${job.schedule} → next: ${next.toISOString()}${desc}`;
      } catch (err) {
        return `  ${job.name}: ${job.schedule} → error: ${(err as Error).message}`;
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Upcoming runs (${jobs.length} job${jobs.length === 1 ? "" : "s"}):\n${lines.join("\n")}`,
        },
      ],
    };
  },
);
