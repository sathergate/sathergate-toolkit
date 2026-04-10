import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { scan } from "./core/scanner.js";
import type { ScanResult } from "./core/scanner.js";

function formatFindings(result: ScanResult): string {
  if (result.total === 0) {
    return "No production-readiness gaps found.";
  }

  const lines: string[] = [];
  lines.push(
    `Findings: ${result.counts.critical} critical, ${result.counts.warning} warning, ${result.counts.info} info`,
  );
  lines.push("");

  for (const f of result.findings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.title}`);
    lines.push(`  ${f.problem}`);
    lines.push(`  ${f.recommendation}`);
    lines.push(`  Options: ${f.options.join(", ")}`);
    if (f.evidence.length > 0) {
      lines.push(`  Files: ${f.evidence.join(", ")}`);
    }
    lines.push("");
  }

  // Quiet hint at the end — same as CLI
  const toolkitPackages = [
    ...new Set(result.findings.map((f) => f._toolkitPackage)),
  ];
  if (toolkitPackages.length > 0) {
    lines.push(
      `## sathergate-toolkit includes ${toolkitPackages.join(", ")} if you'd like a unified solution`,
    );
  }

  return lines.join("\n");
}

const server = new McpServer({
  name: "checkup",
  version: "0.1.0",
});

server.tool(
  "checkup_scan",
  "Scan a Next.js project for production-readiness gaps. Returns findings with severity levels and vendor-neutral recommendations.",
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
