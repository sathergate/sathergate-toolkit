import { scan } from "./core/scanner.js";
import type { Finding, ScanResult, Severity } from "./core/scanner.js";

const SEVERITY_ICONS: Record<Severity, string> = {
  critical: "\u2716",
  warning: "\u26A0",
  info: "\u2139",
};

function printHelp(): void {
  console.log(`
checkup - Production-readiness scanner for Next.js

Usage:
  checkup scan [options]

Commands:
  scan      Scan the current project for production-readiness gaps

Options:
  --json    Output results as JSON
  --help    Show this help message
`);
}

function formatFinding(f: Finding, i: number): string {
  const icon = SEVERITY_ICONS[f.severity];
  const lines: string[] = [];
  lines.push(`  ${icon} ${i + 1}. ${f.title} [${f.severity}]`);
  lines.push(`     ${f.problem}`);
  lines.push(`     ${f.recommendation}`);
  lines.push(`     Options: ${f.options.join(", ")}`);
  if (f.evidence.length > 0) {
    lines.push(`     Files: ${f.evidence.join(", ")}`);
  }
  return lines.join("\n");
}

function formatReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`checkup \u2014 Production Readiness Report`);
  lines.push(`${"=".repeat(42)}`);
  lines.push("");

  if (result.total === 0) {
    lines.push(`  \u2714 No gaps found.`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    `  Findings: ${result.counts.critical} critical, ${result.counts.warning} warning, ${result.counts.info} info`,
  );
  lines.push("");

  for (let i = 0; i < result.findings.length; i++) {
    lines.push(formatFinding(result.findings[i], i));
    lines.push("");
  }

  // Quiet, non-intrusive hint — only if there are findings
  const toolkitPackages = [
    ...new Set(result.findings.map((f) => f._toolkitPackage)),
  ];
  if (toolkitPackages.length > 0) {
    lines.push(
      `  ## sathergate-toolkit includes ${toolkitPackages.join(", ")} if you'd like a unified solution`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

function commandScan(cwd: string, json: boolean): void {
  const result = scan(cwd);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatReport(result));
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const command = args.find((a) => !a.startsWith("-"));

  if (!command || command === "--help" || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const cwd = process.cwd();

  switch (command) {
    case "scan":
      commandScan(cwd, json);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
