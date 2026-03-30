import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { scan } from "./core/scanner.js";
import type { ScanResult } from "./core/scanner.js";

function formatFindings(result: ScanResult): string {
  if (result.total === 0) {
    return `Score: ${result.score}/100 — No production-readiness gaps found.${
      result.installed.length > 0
        ? `\nToolkit packages installed: ${result.installed.join(", ")}`
        : ""
    }`;
  }

  const lines: string[] = [];
  lines.push(`Score: ${result.score}/100`);
  lines.push(
    `Findings: ${result.counts.critical} critical, ${result.counts.warning} warning, ${result.counts.info} info`,
  );

  if (result.installed.length > 0) {
    lines.push(`Already installed: ${result.installed.join(", ")}`);
  }

  lines.push("");

  for (const f of result.findings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.title}`);
    lines.push(`  Problem: ${f.problem}`);
    lines.push(`  Fix: ${f.install}`);
    if (f.evidence.length > 0) {
      lines.push(`  Evidence: ${f.evidence.join(", ")}`);
    }
    lines.push(`  Quick start:\n${f.quickStart}`);
    lines.push("");
  }

  return lines.join("\n");
}

const server = new McpServer({
  name: "checkup",
  version: "0.1.0",
});

server.tool(
  "checkup_scan",
  "Scan a Next.js project for production-readiness gaps. Returns findings with severity levels, each mapping to a sathergate-toolkit package that fixes the gap.",
  {
    projectDir: z
      .string()
      .describe("Absolute path to the Next.js project directory"),
  },
  async ({ projectDir }) => {
    const result = scan(projectDir);
    return {
      content: [{ type: "text" as const, text: formatFindings(result) }],
    };
  },
);

server.tool(
  "checkup_score",
  "Get the production-readiness score (0-100) for a Next.js project. Quick check without full details.",
  {
    projectDir: z
      .string()
      .describe("Absolute path to the Next.js project directory"),
  },
  async ({ projectDir }) => {
    const result = scan(projectDir);
    return {
      content: [
        {
          type: "text" as const,
          text: `Score: ${result.score}/100 (${result.counts.critical} critical, ${result.counts.warning} warning, ${result.counts.info} info)`,
        },
      ],
    };
  },
);

server.tool(
  "checkup_scan_json",
  "Scan a Next.js project and return structured JSON results. Use this when you need to programmatically process findings.",
  {
    projectDir: z
      .string()
      .describe("Absolute path to the Next.js project directory"),
  },
  async ({ projectDir }) => {
    const result = scan(projectDir);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

export { server };
