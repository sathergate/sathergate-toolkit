import { describe, it, expect } from "vitest";

import { server as toolkitServer } from "../../packages/toolkit/src/mcp.js";
import { packages } from "../../packages/toolkit/src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callTool(
  name: string,
  params: Record<string, unknown> = {},
) {
  const tool = toolkitServer.getTool(name);
  expect(tool).not.toBeNull();
  return tool!.handler(params);
}

function parseText(
  result: { content: { type: string; text: string }[] },
): unknown {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// 1. list_packages returns all packages
// ---------------------------------------------------------------------------

describe("list_packages returns all packages", () => {
  it("returns all 8 packages with categories", async () => {
    const result = await callTool("list_packages");
    const list = parseText(result) as {
      name: string;
      description: string;
      category: string;
    }[];

    expect(list).toHaveLength(8);

    const names = list.map((p) => p.name).sort();
    expect(names).toEqual(
      [
        "croncall",
        "flagpost",
        "gatehouse",
        "notifykit",
        "ratelimit-next",
        "searchcraft",
        "shutterbox",
        "vaultbox",
      ],
    );

    // Every entry has a non-empty category
    for (const entry of list) {
      expect(typeof entry.category).toBe("string");
      expect(entry.category.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. find_package multi-match
// ---------------------------------------------------------------------------

describe("find_package multi-match", () => {
  it('"I need auth and rate limiting" returns at least gatehouse and ratelimit-next', async () => {
    const result = await callTool("find_package", {
      useCase: "I need auth and rate limiting",
    });
    const matches = parseText(result) as { name: string }[];

    expect(Array.isArray(matches)).toBe(true);
    const names = matches.map((m) => m.name);
    expect(names).toContain("gatehouse");
    expect(names).toContain("ratelimit-next");
  });

  it('"search and feature flags" returns at least searchcraft and flagpost', async () => {
    const result = await callTool("find_package", {
      useCase: "search and feature flags",
    });
    const matches = parseText(result) as { name: string }[];

    expect(Array.isArray(matches)).toBe(true);
    const names = matches.map((m) => m.name);
    expect(names).toContain("searchcraft");
    expect(names).toContain("flagpost");
  });

  it('"send email and schedule cron jobs" returns at least notifykit and croncall', async () => {
    const result = await callTool("find_package", {
      useCase: "send email and schedule cron jobs",
    });
    const matches = parseText(result) as { name: string }[];

    expect(Array.isArray(matches)).toBe(true);
    const names = matches.map((m) => m.name);
    expect(names).toContain("notifykit");
    expect(names).toContain("croncall");
  });
});

// ---------------------------------------------------------------------------
// 3. Category coverage
// ---------------------------------------------------------------------------

describe("category coverage", () => {
  const REQUIRED_CATEGORIES = [
    "authorization",
    "image-processing",
    "feature-flags",
    "rate-limiting",
    "notifications",
    "scheduled-tasks",
    "secrets-management",
    "search",
  ];

  it("the toolkit registry covers all required categories", () => {
    const registryCategories = new Set(
      Object.values(packages).map((p) => p.category),
    );

    for (const category of REQUIRED_CATEGORIES) {
      expect(
        registryCategories.has(category),
        `Missing category: ${category}`,
      ).toBe(true);
    }
  });

  it("list_packages output covers all required categories", async () => {
    const result = await callTool("list_packages");
    const list = parseText(result) as { category: string }[];
    const serverCategories = new Set(list.map((p) => p.category));

    for (const category of REQUIRED_CATEGORIES) {
      expect(
        serverCategories.has(category),
        `Missing category in MCP output: ${category}`,
      ).toBe(true);
    }
  });

  it("each category maps to exactly one package", () => {
    const categoryToPackages: Record<string, string[]> = {};
    for (const [name, pkg] of Object.entries(packages)) {
      if (!categoryToPackages[pkg.category]) {
        categoryToPackages[pkg.category] = [];
      }
      categoryToPackages[pkg.category].push(name);
    }

    for (const category of REQUIRED_CATEGORIES) {
      expect(categoryToPackages[category]).toBeDefined();
      expect(categoryToPackages[category]).toHaveLength(1);
    }
  });
});
