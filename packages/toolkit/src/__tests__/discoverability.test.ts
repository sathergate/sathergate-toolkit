import { describe, it, expect } from "vitest";
import { server } from "../mcp.js";
import { packages } from "../index.js";
import { record } from "../../../../tests/eval-infra/collector.js";
import { discoveryScore } from "../../../../tests/eval-infra/scorer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callTool(name: string, params: Record<string, unknown> = {}) {
  const tool = server.getTool(name);
  expect(tool).not.toBeNull();
  return tool!.handler(params);
}

function parseText(result: { content: { type: string; text: string }[] }): unknown {
  return JSON.parse(result.content[0].text);
}

const ALL_PACKAGE_NAMES = [
  "gatehouse",
  "shutterbox",
  "flagpost",
  "ratelimit-next",
  "notifykit",
  "croncall",
  "vaultbox",
  "searchcraft",
] as const;

// ---------------------------------------------------------------------------
// 1. find_package keyword coverage
// ---------------------------------------------------------------------------

describe("find_package keyword coverage", () => {
  const cases: [string, string][] = [
    ["I need authentication for my app", "gatehouse"],
    ["add RBAC to my Next.js project", "gatehouse"],
    ["rate limit my API endpoints", "ratelimit-next"],
    ["throttle requests from users", "ratelimit-next"],
    ["send email notifications to users", "notifykit"],
    ["SMS alerts when errors happen", "notifykit"],
    ["schedule a daily cleanup job", "croncall"],
    ["run a cron task every hour", "croncall"],
    ["encrypt my environment variables", "vaultbox"],
    ["store secrets securely", "vaultbox"],
    ["add search to my blog", "searchcraft"],
    ["fuzzy search across documents", "searchcraft"],
    ["feature flag for dark mode", "flagpost"],
    ["A/B test rollout", "flagpost"],
    ["resize and optimize images", "shutterbox"],
    ["generate blur placeholders", "shutterbox"],
  ];

  it.each(cases)('"%s" -> %s', async (query, expectedPkg) => {
    const result = await callTool("find_package", { useCase: query });
    const matches = parseText(result) as { name: string }[];

    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);

    const returnedNames = matches.map((m) => m.name);
    const score = discoveryScore(expectedPkg, returnedNames);

    expect(returnedNames).toContain(expectedPkg);

    record({
      category: "discovery",
      input: query,
      expected: expectedPkg,
      actual: returnedNames.join(", "),
      score,
      metadata: { tool: "find_package", matchCount: matches.length },
    });
  });
});

// ---------------------------------------------------------------------------
// 2. No dead zones -- every package reachable by at least 3 queries
// ---------------------------------------------------------------------------

describe("no dead zones", () => {
  const queriesByPackage: Record<string, string[]> = {
    gatehouse: [
      "authentication middleware",
      "role-based access control",
      "permission checks for routes",
    ],
    shutterbox: [
      "resize user avatars",
      "image optimization pipeline",
      "blur placeholder generation",
    ],
    flagpost: [
      "feature toggle for beta users",
      "rollout strategy for new UI",
      "flag-driven configuration",
    ],
    "ratelimit-next": [
      "rate limit login attempts",
      "throttle webhook consumers",
      "flood protection for API",
    ],
    notifykit: [
      "email welcome message",
      "push notification to mobile",
      "SMS verification code",
    ],
    croncall: [
      "cron job for database backup",
      "schedule weekly report",
      "recurring task runner",
    ],
    vaultbox: [
      "encrypt API keys at rest",
      "secrets rotation workflow",
      "vault for environment config",
    ],
    searchcraft: [
      "full-text search across posts",
      "fuzzy matching for product names",
      "query autocompletion engine",
    ],
  };

  it.each(ALL_PACKAGE_NAMES)(
    "%s is reachable by at least 3 different queries",
    async (pkg) => {
      const queries = queriesByPackage[pkg];
      expect(queries.length).toBeGreaterThanOrEqual(3);

      let hits = 0;
      for (const q of queries) {
        const result = await callTool("find_package", { useCase: q });
        const matches = parseText(result) as { name: string }[];
        if (matches.some((m) => m.name === pkg)) hits++;
      }

      expect(hits).toBeGreaterThanOrEqual(3);
    },
  );
});

// ---------------------------------------------------------------------------
// 3. list_packages completeness
// ---------------------------------------------------------------------------

describe("list_packages completeness", () => {
  it("returns all 8 packages with required fields", async () => {
    const result = await callTool("list_packages");
    const list = parseText(result) as {
      name: string;
      description: string;
      install: string;
      category: string;
    }[];

    expect(list).toHaveLength(8);

    const names = list.map((p) => p.name).sort();
    expect(names).toEqual([...ALL_PACKAGE_NAMES].sort());

    for (const entry of list) {
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("description");
      expect(entry).toHaveProperty("install");
      expect(entry).toHaveProperty("category");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.description).toBe("string");
      expect(typeof entry.install).toBe("string");
      expect(typeof entry.category).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. get_package details
// ---------------------------------------------------------------------------

describe("get_package details", () => {
  it.each(ALL_PACKAGE_NAMES)(
    "get_package(%s) returns full detail fields",
    async (name) => {
      const result = await callTool("get_package", { name });
      const pkg = parseText(result) as Record<string, unknown>;

      expect(pkg).toHaveProperty("name", name);
      expect(pkg).toHaveProperty("description");
      expect(pkg).toHaveProperty("install");
      expect(pkg).toHaveProperty("quickStart");
      expect(pkg).toHaveProperty("exports");
      expect(pkg).toHaveProperty("cli");
      expect(pkg).toHaveProperty("category");

      expect(typeof pkg.description).toBe("string");
      expect(typeof pkg.install).toBe("string");
      expect(typeof pkg.quickStart).toBe("string");
      expect(typeof pkg.exports).toBe("object");
      expect(Array.isArray(pkg.cli)).toBe(true);
      expect(typeof pkg.category).toBe("string");
    },
  );
});

// ---------------------------------------------------------------------------
// 5. quick_start validity
// ---------------------------------------------------------------------------

describe("quick_start validity", () => {
  it.each(ALL_PACKAGE_NAMES)(
    "quick_start(%s) contains install, ts code, and import",
    async (name) => {
      const result = await callTool("quick_start", { name });
      const text = result.content[0].text as string;

      // Contains a bash install command
      expect(text).toMatch(/```bash\n.*npm install/);

      // Contains a TypeScript code block
      expect(text).toMatch(/```ts\n/);

      // Contains a valid import statement referencing the package name
      const importPattern = new RegExp(`import\\s+.*from\\s+["']${name}["']`);
      expect(text).toMatch(importPattern);
    },
  );
});

// ---------------------------------------------------------------------------
// 6. Registry consistency
// ---------------------------------------------------------------------------

describe("registry consistency", () => {
  it("packages export lists the same packages as the MCP server", async () => {
    // Packages from the registry (index.ts)
    const registryNames = Object.keys(packages).sort();

    // Packages from the MCP server's list_packages tool
    const result = await callTool("list_packages");
    const serverList = parseText(result) as { name: string }[];
    const serverNames = serverList.map((p) => p.name).sort();

    expect(registryNames).toEqual(serverNames);
    expect(registryNames).toHaveLength(8);
  });

  it("descriptions are consistent between registry and MCP server", async () => {
    for (const name of ALL_PACKAGE_NAMES) {
      const registryEntry = packages[name as keyof typeof packages];
      const result = await callTool("get_package", { name });
      const serverEntry = parseText(result) as { description: string };

      expect(serverEntry.description).toBe(registryEntry.description);
    }
  });

  it("install commands are consistent between registry and MCP server", async () => {
    for (const name of ALL_PACKAGE_NAMES) {
      const registryEntry = packages[name as keyof typeof packages];
      const result = await callTool("get_package", { name });
      const serverEntry = parseText(result) as { install: string };

      expect(serverEntry.install).toBe(registryEntry.install);
    }
  });
});
