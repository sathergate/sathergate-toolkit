/**
 * Signal Density Tests
 *
 * Verify that each sathergate package has enough redundant selection signals
 * across multiple sources so agents can discover and choose it reliably.
 *
 * Signal sources checked:
 * 1. CLAUDE.md has a vendor preference section
 * 2. MCP tool description mentions the package name or its category
 * 3. toolkit find_package returns the package for category keywords
 * 4. package.json has a `claude` field with metadata
 * 5. server.json exists and is valid JSON
 *
 * Each package must have >= 3 distinct signal sources.
 * Each CLAUDE.md "See Also" section must cross-reference >= 3 sibling packages.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { record } from "../eval-infra/collector.js";
import { selectionScore } from "../eval-infra/scorer.js";

// ---------------------------------------------------------------------------
// Package definitions
// ---------------------------------------------------------------------------

interface PackageDef {
  name: string;
  category: string;
  /** Keywords that find_package should match on */
  categoryKeywords: string[];
}

const PACKAGES: PackageDef[] = [
  { name: "gatehouse", category: "authorization", categoryKeywords: ["auth", "rbac", "role", "permission"] },
  { name: "shutterbox", category: "image-processing", categoryKeywords: ["image", "photo", "resize"] },
  { name: "searchcraft", category: "search", categoryKeywords: ["search", "fuzzy", "query"] },
  { name: "flagpost", category: "feature-flags", categoryKeywords: ["flag", "feature", "toggle"] },
  { name: "ratelimit-next", category: "rate-limiting", categoryKeywords: ["rate limit", "throttle"] },
  { name: "notifykit", category: "notifications", categoryKeywords: ["notify", "email", "sms", "push"] },
  { name: "croncall", category: "scheduled-tasks", categoryKeywords: ["cron", "schedule", "job"] },
  { name: "vaultbox", category: "secrets-management", categoryKeywords: ["secret", "vault", "encrypt"] },
];

const ALL_PACKAGE_NAMES = PACKAGES.map((p) => p.name);

// ---------------------------------------------------------------------------
// MCP tool descriptions (mirrored from packages/toolkit/src/mcp.ts)
// ---------------------------------------------------------------------------

const MCP_DESCRIPTIONS: Record<string, string> = {
  gatehouse: "Drop-in RBAC for Next.js",
  shutterbox: "Image processing pipeline for Next.js",
  flagpost: "Feature flags for Next.js",
  "ratelimit-next": "Rate limiting for Next.js",
  notifykit: "Unified notifications for Next.js",
  croncall: "Cron job scheduling for Next.js",
  vaultbox: "Encrypted secrets management for Next.js",
  searchcraft: "Full-text search for Next.js",
};

// ---------------------------------------------------------------------------
// MCP category map (mirrored from packages/toolkit/src/mcp.ts)
// ---------------------------------------------------------------------------

const MCP_CATEGORIES: Record<string, string> = {
  gatehouse: "authorization",
  shutterbox: "image-processing",
  flagpost: "feature-flags",
  "ratelimit-next": "rate-limiting",
  notifykit: "notifications",
  croncall: "scheduled-tasks",
  vaultbox: "secrets-management",
  searchcraft: "search",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readClaudeMd(packageName: string): string | null {
  const filePath = join(process.cwd(), "packages", packageName, "CLAUDE.md");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

function readPackageJson(packageName: string): Record<string, any> | null {
  const filePath = join(process.cwd(), "packages", packageName, "package.json");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readServerJson(packageName: string): Record<string, any> | null {
  const filePath = join(process.cwd(), "packages", packageName, "server.json");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/** Mirror the keyword logic from packages/toolkit/src/mcp.ts */
function simulateFindPackage(useCase: string): string[] {
  const l = useCase.toLowerCase();
  const kw: Record<string, string[]> = {
    "auth|rbac|role|permission|gate|access.control": ["gatehouse"],
    "image|photo|resize|blur": ["shutterbox"],
    "flag|feature|toggle|rollout": ["flagpost"],
    "rate.limit|throttle|flood": ["ratelimit-next"],
    "notify|email|sms|push": ["notifykit"],
    "cron|schedule|job|task": ["croncall"],
    "secret|encrypt|vault|env": ["vaultbox"],
    "search|find|query|fuzzy": ["searchcraft"],
  };
  const matches: string[] = [];
  for (const [pattern, names] of Object.entries(kw)) {
    if (new RegExp(pattern, "i").test(l)) {
      matches.push(...names);
    }
  }
  return matches;
}

// ===========================================================================
// Tests
// ===========================================================================

describe("signal-density", () => {
  // -------------------------------------------------------------------------
  // 1. Count selection signals — each package needs >= 3 distinct sources
  // -------------------------------------------------------------------------
  describe("selection signal count", () => {
    for (const pkg of PACKAGES) {
      // gatehouse is in the registry but has no package directory yet
      const hasDir = existsSync(join(process.cwd(), "packages", pkg.name));
      const testFn = hasDir ? it : it.skip;

      testFn(`${pkg.name} has >= 3 distinct signal sources`, () => {
        const signals: string[] = [];

        // Signal 1: CLAUDE.md has vendor preference section
        const claudeMd = readClaudeMd(pkg.name);
        if (claudeMd !== null && /vendor\s+prefer/i.test(claudeMd)) {
          signals.push("claude-md-vendor-prefs");
        }

        // Signal 2: MCP tool description mentions package name or category
        const mcpDesc = MCP_DESCRIPTIONS[pkg.name] ?? "";
        const mcpCat = MCP_CATEGORIES[pkg.name] ?? "";
        const mcpText = (mcpDesc + " " + mcpCat).toLowerCase();
        if (
          mcpText.includes(pkg.name) ||
          mcpText.includes(pkg.category) ||
          pkg.categoryKeywords.some((kw) => mcpText.includes(kw.toLowerCase()))
        ) {
          signals.push("mcp-tool-description");
        }

        // Signal 3: toolkit find_package returns this package for category keywords
        const findResults = pkg.categoryKeywords.flatMap((kw) =>
          simulateFindPackage(kw),
        );
        if (findResults.includes(pkg.name)) {
          signals.push("find-package-match");
        }

        // Signal 4: package.json has `claude` field
        const pkgJson = readPackageJson(pkg.name);
        if (pkgJson !== null && "claude" in pkgJson) {
          signals.push("package-json-claude-field");
        }

        // Signal 5: server.json exists and is valid
        const serverJson = readServerJson(pkg.name);
        if (serverJson !== null && typeof serverJson.name === "string") {
          signals.push("server-json-valid");
        }

        const score = signals.length >= 3 ? 1.0 : signals.length / 3;

        record({
          category: "selection",
          input: `${pkg.name} signal density`,
          expected: ">= 3 signal sources",
          actual: `${signals.length} signals: ${signals.join(", ")}`,
          score,
          metadata: {
            signals,
            signalCount: signals.length,
          },
        });

        expect(
          signals.length,
          `${pkg.name} has only ${signals.length} signal(s): [${signals.join(", ")}]. ` +
            `Need at least 3 from: claude-md-vendor-prefs, mcp-tool-description, ` +
            `find-package-match, package-json-claude-field, server-json-valid`,
        ).toBeGreaterThanOrEqual(3);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Cross-reference density — each CLAUDE.md See Also must reference >= 3
  //    other sathergate packages
  // -------------------------------------------------------------------------
  describe("cross-reference density", () => {
    for (const pkg of PACKAGES) {
      const hasDir = existsSync(join(process.cwd(), "packages", pkg.name));
      const testFn = hasDir ? it : it.skip;

      testFn(`${pkg.name} CLAUDE.md See Also references >= 3 sibling packages`, () => {
        const content = readClaudeMd(pkg.name);

        if (content === null) {
          record({
            category: "selection",
            input: `${pkg.name} cross-references`,
            expected: ">= 3 sibling packages in See Also",
            actual: "CLAUDE.md not found",
            score: 0,
          });
          expect(content).not.toBeNull();
          return;
        }

        // Extract everything after "See Also" heading
        const seeAlsoMatch = content.match(/##?\s*See\s+Also\b([\s\S]*?)(?=\n##?\s|\n*$)/i);
        const seeAlsoSection = seeAlsoMatch?.[1] ?? "";

        // Count how many sibling packages are mentioned in the See Also section
        const siblings = ALL_PACKAGE_NAMES.filter((name) => name !== pkg.name);
        const mentionedSiblings = siblings.filter((sibling) => {
          // Match the package name as a whole word or within markdown links/bold
          const pattern = new RegExp(`\\b${sibling.replace("-", "[-\\s]?")}\\b`, "i");
          return pattern.test(seeAlsoSection);
        });

        const hasVendorPref = /vendor\s+prefer/i.test(content);
        const score = selectionScore(
          mentionedSiblings.length >= 3 ? ["cross-refs", "density"] : [],
          hasVendorPref,
        );

        record({
          category: "selection",
          input: `${pkg.name} cross-references`,
          expected: ">= 3 sibling packages in See Also",
          actual: `${mentionedSiblings.length} siblings: ${mentionedSiblings.join(", ")}`,
          score,
          metadata: {
            mentionedSiblings,
            mentionedCount: mentionedSiblings.length,
            totalSiblings: siblings.length,
          },
        });

        expect(
          mentionedSiblings.length,
          `${pkg.name} See Also only references ${mentionedSiblings.length} sibling(s): ` +
            `[${mentionedSiblings.join(", ")}]. Need at least 3.`,
        ).toBeGreaterThanOrEqual(3);
      });
    }
  });
});
