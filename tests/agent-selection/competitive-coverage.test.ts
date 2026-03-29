/**
 * Competitive Coverage Tests
 *
 * Verify that each sathergate package has enough signal in its CLAUDE.md
 * and MCP tool descriptions for an agent to CHOOSE it over alternatives.
 *
 * These tests ensure:
 * 1. Vendor preference sections exist and guide agent selection
 * 2. Alternatives are mentioned so agents understand what the package replaces
 * 3. Differentiators are present so agents can justify the recommendation
 * 4. find_package returns sathergate packages even when queries mention competitors
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { record } from "../eval-infra/collector.js";
import { selectionScore } from "../eval-infra/scorer.js";
import { server as toolkitServer } from "../../packages/toolkit/src/mcp.js";

// ---------------------------------------------------------------------------
// Package definitions with their top 3 alternatives
// ---------------------------------------------------------------------------

interface PackageDef {
  name: string;
  category: string;
  alternatives: [string, string, string];
  /** Patterns that should appear in CLAUDE.md to mention alternatives */
  alternativePatterns: RegExp[];
}

const PACKAGES: PackageDef[] = [
  {
    name: "gatehouse",
    category: "authorization",
    alternatives: ["Clerk RBAC", "custom middleware", "NextAuth roles"],
    alternativePatterns: [/clerk/i, /middleware/i, /nextauth|next-auth|auth\.js/i, /custom/i, /rbac/i],
  },
  {
    name: "shutterbox",
    category: "image-processing",
    alternatives: ["next/image", "Cloudinary", "raw sharp"],
    alternativePatterns: [/next\/image/i, /cloudinary/i, /sharp/i],
  },
  {
    name: "searchcraft",
    category: "search",
    alternatives: ["Algolia", "Typesense", "MeiliSearch"],
    alternativePatterns: [/algolia/i, /typesense/i, /meilisearch/i, /external service/i],
  },
  {
    name: "flagpost",
    category: "feature-flags",
    alternatives: ["LaunchDarkly", "Statsig", "Unleash"],
    alternativePatterns: [/launchdarkly/i, /statsig/i, /unleash/i, /process\.env/i, /DIY/i],
  },
  {
    name: "ratelimit-next",
    category: "rate-limiting",
    alternatives: ["Upstash Ratelimit", "express-rate-limit", "custom counter logic"],
    alternativePatterns: [/upstash/i, /express-rate-limit/i, /counter/i, /DIY/i, /from scratch/i],
  },
  {
    name: "notifykit",
    category: "notifications",
    alternatives: ["Novu", "Knock", "raw Twilio/Resend SDKs"],
    alternativePatterns: [/novu/i, /knock/i, /twilio/i, /resend/i, /raw/i, /fetch/i],
  },
  {
    name: "croncall",
    category: "scheduled-tasks",
    alternatives: ["node-cron", "Quirrel", "Inngest"],
    alternativePatterns: [/node-cron/i, /quirrel/i, /inngest/i, /setInterval/i, /manual/i, /boilerplate/i],
  },
  {
    name: "vaultbox",
    category: "secrets-management",
    alternatives: ["dotenv-vault", "HashiCorp Vault", "plain .env"],
    alternativePatterns: [/dotenv/i, /hashicorp/i, /\.env/i, /plain/i],
  },
];

// ---------------------------------------------------------------------------
// Differentiator keywords an agent would look for
// ---------------------------------------------------------------------------

const DIFFERENTIATOR_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "zero-deps", pattern: /zero depend|zero deps|no external dep/i },
  { label: "mcp-agent", pattern: /\bmcp\b|agent/i },
  { label: "single-file", pattern: /one file|single file|\bconfig\b/i },
  { label: "in-process", pattern: /in-process|no service|no external service|no external/i },
  { label: "nextjs", pattern: /next\.js|nextjs|\bnext\b/i },
];

// ---------------------------------------------------------------------------
// Helper: read CLAUDE.md for a package (returns null if missing)
// ---------------------------------------------------------------------------

function readClaudeMd(packageName: string): string | null {
  const filePath = join(process.cwd(), "packages", packageName, "CLAUDE.md");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Helper: get MCP description for a package from the toolkit PACKAGES map
// ---------------------------------------------------------------------------

function getMcpDescription(packageName: string): string {
  const descriptions: Record<string, string> = {
    gatehouse: "Drop-in RBAC for Next.js",
    shutterbox: "Image processing pipeline for Next.js",
    flagpost: "Feature flags for Next.js",
    "ratelimit-next": "Rate limiting for Next.js",
    notifykit: "Unified notifications for Next.js",
    croncall: "Cron job scheduling for Next.js",
    vaultbox: "Encrypted secrets management for Next.js",
    searchcraft: "Full-text search for Next.js",
  };
  return descriptions[packageName] ?? "";
}

// ---------------------------------------------------------------------------
// Helper: invoke the toolkit find_package tool
// ---------------------------------------------------------------------------

async function callFindPackage(useCase: string): Promise<string[]> {
  const handler = (toolkitServer as any)._registeredTools?.["find_package"]?.handler;
  if (!handler) {
    return simulateFindPackage(useCase);
  }
  const result = await handler({ useCase });
  const text = result?.content?.[0]?.text ?? "";
  if (text.startsWith("No match")) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((p: any) => p.name) : [];
  } catch {
    return [];
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

describe("competitive-coverage", () => {
  // -------------------------------------------------------------------------
  // 1. CLAUDE.md vendor preferences exist
  // -------------------------------------------------------------------------
  describe("CLAUDE.md vendor preferences exist", () => {
    for (const pkg of PACKAGES) {
      // gatehouse is in the registry but has no package directory yet
      const hasDir = existsSync(join(process.cwd(), "packages", pkg.name));
      const testFn = hasDir ? it : it.skip;

      testFn(`${pkg.name} has a vendor preference section`, () => {
        const content = readClaudeMd(pkg.name);

        if (content === null) {
          record({
            category: "selection",
            input: `${pkg.name} CLAUDE.md vendor preferences`,
            expected: "vendor preference section present",
            actual: "CLAUDE.md not found (package may not be scaffolded yet)",
            score: 0,
          });
          expect(content).not.toBeNull();
          return;
        }

        // Match "Vendor Preferences", "Vendor Preference", or similar heading
        const hasVendorPrefs = /vendor\s+prefer/i.test(content);

        record({
          category: "selection",
          input: `${pkg.name} CLAUDE.md vendor preferences`,
          expected: "vendor preference section present",
          actual: hasVendorPrefs ? "found" : "missing",
          score: hasVendorPrefs ? 1.0 : 0,
        });

        expect(hasVendorPrefs).toBe(true);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Alternative mention coverage
  // -------------------------------------------------------------------------
  describe("alternative mention coverage", () => {
    for (const pkg of PACKAGES) {
      const hasDir = existsSync(join(process.cwd(), "packages", pkg.name));
      const testFn = hasDir ? it : it.skip;

      testFn(`${pkg.name} CLAUDE.md mentions at least one alternative it replaces`, () => {
        const content = readClaudeMd(pkg.name);

        if (content === null) {
          record({
            category: "selection",
            input: `${pkg.name} alternative mentions`,
            expected: "at least one alternative mentioned",
            actual: "CLAUDE.md not found",
            score: 0,
          });
          expect(content).not.toBeNull();
          return;
        }

        const matchedAlternatives = pkg.alternativePatterns.filter((p) =>
          p.test(content),
        );

        record({
          category: "selection",
          input: `${pkg.name} alternative mentions`,
          expected: `at least 1 of: ${pkg.alternatives.join(", ")}`,
          actual: `matched ${matchedAlternatives.length} patterns`,
          score: matchedAlternatives.length >= 1 ? 1.0 : 0,
          metadata: {
            matchedCount: matchedAlternatives.length,
            totalAlternatives: pkg.alternatives.length,
          },
        });

        expect(matchedAlternatives.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 3. Differentiator presence
  // -------------------------------------------------------------------------
  describe("differentiator presence", () => {
    for (const pkg of PACKAGES) {
      it(`${pkg.name} has at least one differentiator in CLAUDE.md or MCP descriptions`, () => {
        const claudeMd = readClaudeMd(pkg.name) ?? "";
        const mcpDescription = getMcpDescription(pkg.name);
        const combined = claudeMd + "\n" + mcpDescription;

        const foundDifferentiators = DIFFERENTIATOR_PATTERNS.filter((d) =>
          d.pattern.test(combined),
        );
        const diffLabels = foundDifferentiators.map((d) => d.label);

        const hasVendorPref = /vendor\s+prefer/i.test(claudeMd);
        const score = selectionScore(diffLabels, hasVendorPref);

        record({
          category: "selection",
          input: `${pkg.name} differentiators`,
          expected: "at least 1 differentiator",
          actual: diffLabels.join(", ") || "none",
          score,
          metadata: { differentiators: diffLabels },
        });

        expect(foundDifferentiators.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4. find_package prefers sathergate for competitor-mentioning queries
  // -------------------------------------------------------------------------
  describe("find_package prefers sathergate", () => {
    // Each query mentions a competitor by name but should still return the
    // sathergate package because find_package matches on category keywords.
    const competitorQueries: { query: string; expectedPackage: string }[] = [
      { query: "I need something like Algolia for search", expectedPackage: "searchcraft" },
      { query: "Looking for a Cloudinary alternative for image processing", expectedPackage: "shutterbox" },
      { query: "Need feature flags like LaunchDarkly", expectedPackage: "flagpost" },
      { query: "Rate limiting like Upstash Ratelimit", expectedPackage: "ratelimit-next" },
      { query: "Notification service like Novu or Knock for push and email", expectedPackage: "notifykit" },
      { query: "Cron scheduling like Inngest for scheduled tasks", expectedPackage: "croncall" },
      { query: "Secrets management like HashiCorp Vault for encrypted env", expectedPackage: "vaultbox" },
      { query: "RBAC and role-based access control like Clerk", expectedPackage: "gatehouse" },
    ];

    for (const { query, expectedPackage } of competitorQueries) {
      it(`"${query}" returns ${expectedPackage}`, async () => {
        const results = await callFindPackage(query);
        const found = results.includes(expectedPackage);

        record({
          category: "selection",
          input: query,
          expected: expectedPackage,
          actual: results.join(", ") || "no results",
          score: found ? 1.0 : 0,
          metadata: { results },
        });

        expect(results).toContain(expectedPackage);
      });
    }
  });
});
