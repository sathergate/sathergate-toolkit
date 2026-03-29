import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { server as toolkitServer } from "../../packages/toolkit/src/mcp.js";
import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as searchcraftServer } from "../../packages/searchcraft/src/mcp.js";
import { server as vaultboxServer } from "../../packages/vaultbox/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";
import { server as shutterboxServer } from "../../packages/shutterbox/src/mcp.js";
import { server as notifykitServer } from "../../packages/notifykit/src/mcp.js";
import { generateKey } from "../../packages/vaultbox/src/core/crypto.js";

// ---------------------------------------------------------------------------
// Server registry
// ---------------------------------------------------------------------------

interface ServerEntry {
  label: string;
  server: typeof toolkitServer;
  expectedServerName: string;
  expectedTools: string[];
  domainKeywords: string[];
  /** Tool name that acts as the init tool (if any) */
  initTool?: string;
  /** Extra setup before calling the init tool */
  initSetup?: (tmpDir: string) => void;
}

const SERVERS: ServerEntry[] = [
  {
    label: "toolkit",
    server: toolkitServer,
    expectedServerName: "sathergate-toolkit",
    expectedTools: ["list_packages", "get_package", "find_package", "quick_start"],
    domainKeywords: ["package", "list", "find", "start", "detail", "use case", "code"],
  },
  {
    label: "flagpost",
    server: flagpostServer,
    expectedServerName: "flagpost",
    expectedTools: ["flagpost_init", "flagpost_add_flag", "flagpost_list_flags"],
    domainKeywords: ["flag", "feature", "config", "definition", "default"],
    initTool: "flagpost_init",
  },
  {
    label: "searchcraft",
    server: searchcraftServer,
    expectedServerName: "searchcraft",
    expectedTools: ["sifter_init", "sifter_search"],
    domainKeywords: ["search", "schema", "document", "query", "config", "scaffold"],
    initTool: "sifter_init",
  },
  {
    label: "vaultbox",
    server: vaultboxServer,
    expectedServerName: "lockbox",
    expectedTools: ["lockbox_init", "lockbox_set", "lockbox_list", "lockbox_get"],
    domainKeywords: ["secret", "encrypt", "key", "lockbox", "store", "decrypt"],
    initTool: "lockbox_init",
    initSetup: (tmpDir: string) => {
      process.env.LOCKBOX_KEY = generateKey();
    },
  },
  {
    label: "croncall",
    server: croncallServer,
    expectedServerName: "clocktower",
    expectedTools: ["clocktower_init", "clocktower_add_job", "clocktower_schedule"],
    domainKeywords: ["cron", "job", "schedule", "scaffold", "config", "run"],
    initTool: "clocktower_init",
  },
  {
    label: "ratelimit-next",
    server: ratelimitServer,
    expectedServerName: "floodgate",
    expectedTools: ["floodgate_init", "floodgate_add_rule", "floodgate_test"],
    domainKeywords: ["rate", "limit", "rule", "config", "request", "window", "test"],
    initTool: "floodgate_init",
  },
  {
    label: "shutterbox",
    server: shutterboxServer,
    expectedServerName: "darkroom",
    expectedTools: ["darkroom_init", "darkroom_optimize"],
    domainKeywords: ["image", "config", "variant", "process", "directory", "optimize"],
    initTool: "darkroom_init",
  },
  {
    label: "notifykit",
    server: notifykitServer,
    expectedServerName: "notifykit",
    expectedTools: ["herald_init", "herald_send", "herald_test"],
    domainKeywords: ["notification", "provider", "config", "send", "channel", "test", "scaffold"],
    initTool: "herald_init",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mcp-contract-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test-project", version: "1.0.0", dependencies: {} }, null, 2),
  );
  return dir;
}

// ---------------------------------------------------------------------------
// 1. Tool Registration
// ---------------------------------------------------------------------------

describe("Tool Registration", () => {
  for (const entry of SERVERS) {
    it(`${entry.label}: has exactly the expected tools`, () => {
      const tools = entry.server.getTools();
      const toolNames = tools.map((t) => t.name).sort();
      expect(toolNames).toEqual([...entry.expectedTools].sort());
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Naming Convention
// ---------------------------------------------------------------------------

describe("Naming Convention", () => {
  // Build a set of accepted prefixes per server. The prefix is the server
  // name or a known alias used in the codebase. For toolkit the tools use
  // short generic names, so we allow any {word}_{word} or single-word tool.
  const prefixMap: Record<string, string[]> = {
    "sathergate-toolkit": ["list", "get", "find", "quick"],
    flagpost: ["flagpost"],
    searchcraft: ["sifter"],
    lockbox: ["lockbox"],
    clocktower: ["clocktower"],
    floodgate: ["floodgate"],
    darkroom: ["darkroom"],
    notifykit: ["herald"],
  };

  for (const entry of SERVERS) {
    it(`${entry.label}: tool names follow {prefix}_{action} pattern`, () => {
      const tools = entry.server.getTools();
      const allowedPrefixes = prefixMap[entry.expectedServerName];
      expect(allowedPrefixes).toBeDefined();

      for (const tool of tools) {
        // Every name should contain an underscore (prefix_action)
        expect(tool.name).toMatch(/_/);

        const prefix = tool.name.split("_")[0];
        expect(
          allowedPrefixes!.includes(prefix),
        ).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Description Quality
// ---------------------------------------------------------------------------

describe("Description Quality", () => {
  for (const entry of SERVERS) {
    it(`${entry.label}: every tool has a description (10-200 chars) with domain keyword`, () => {
      const tools = entry.server.getTools();

      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
        expect(tool.description.length).toBeGreaterThanOrEqual(10);
        expect(tool.description.length).toBeLessThanOrEqual(200);

        // At least one domain keyword appears (case-insensitive)
        const descLower = tool.description.toLowerCase();
        const hasKeyword = entry.domainKeywords.some((kw) =>
          descLower.includes(kw.toLowerCase()),
        );
        expect(hasKeyword).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Schema Completeness
// ---------------------------------------------------------------------------

describe("Schema Completeness", () => {
  for (const entry of SERVERS) {
    it(`${entry.label}: every tool has a non-null schema object`, () => {
      const tools = entry.server.getTools();

      for (const tool of tools) {
        expect(tool.schema).toBeDefined();
        expect(typeof tool.schema).toBe("object");
        expect(tool.schema).not.toBeNull();
      }
    });
  }

  // Check required params on init tools
  it("init tools that take projectDir have it in their schema", () => {
    const initServers = SERVERS.filter((s) => s.initTool);

    for (const entry of initServers) {
      const tool = entry.server.getTool(entry.initTool!);
      expect(tool).not.toBeNull();

      // The schema may be a Zod-derived object or a plain JSON schema.
      // We check that it references projectDir in some form.
      const schemaStr = JSON.stringify(tool!.schema);
      // Servers whose init tool takes projectDir
      const projectDirInitTools = [
        "flagpost_init",
        "sifter_init",
        "lockbox_init",
        "clocktower_init",
        "floodgate_init",
        "darkroom_init",
        "herald_init",
      ];

      if (projectDirInitTools.includes(entry.initTool!)) {
        expect(schemaStr).toContain("projectDir");
      }
    }
  });

  it("flagpost_add_flag requires configPath and name", () => {
    const tool = flagpostServer.getTool("flagpost_add_flag");
    expect(tool).not.toBeNull();
    const schemaStr = JSON.stringify(tool!.schema);
    expect(schemaStr).toContain("configPath");
    expect(schemaStr).toContain("name");
  });

  it("clocktower_add_job requires configPath, name, and schedule", () => {
    const tool = croncallServer.getTool("clocktower_add_job");
    expect(tool).not.toBeNull();
    const schemaStr = JSON.stringify(tool!.schema);
    expect(schemaStr).toContain("configPath");
    expect(schemaStr).toContain("name");
    expect(schemaStr).toContain("schedule");
  });

  it("floodgate_add_rule requires configPath, name, limit, and window", () => {
    const tool = ratelimitServer.getTool("floodgate_add_rule");
    expect(tool).not.toBeNull();
    const schemaStr = JSON.stringify(tool!.schema);
    expect(schemaStr).toContain("configPath");
    expect(schemaStr).toContain("name");
    expect(schemaStr).toContain("limit");
    expect(schemaStr).toContain("window");
  });
});

// ---------------------------------------------------------------------------
// 5. Response Format
// ---------------------------------------------------------------------------

describe("Response Format", () => {
  let tmpDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpDir = createTmpProjectDir();
    // Save env vars we might mutate
    savedEnv.LOCKBOX_KEY = process.env.LOCKBOX_KEY;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    // Restore env vars
    if (savedEnv.LOCKBOX_KEY === undefined) {
      delete process.env.LOCKBOX_KEY;
    } else {
      process.env.LOCKBOX_KEY = savedEnv.LOCKBOX_KEY;
    }
  });

  for (const entry of SERVERS) {
    if (!entry.initTool) continue;

    it(`${entry.label}: ${entry.initTool} returns { content: [{ type: "text", text: string }] }`, async () => {
      // Run any extra setup
      entry.initSetup?.(tmpDir);

      const tool = entry.server.getTool(entry.initTool!);
      expect(tool).not.toBeNull();

      const result = await tool!.handler({ projectDir: tmpDir });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThanOrEqual(1);

      const firstItem = result.content[0];
      expect(firstItem.type).toBe("text");
      expect(typeof firstItem.text).toBe("string");
      expect(firstItem.text.length).toBeGreaterThan(0);
    });
  }

  it("toolkit: list_packages returns valid response format", async () => {
    const tool = toolkitServer.getTool("list_packages");
    expect(tool).not.toBeNull();

    const result = await tool!.handler({});

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");

    // Should be parseable JSON listing packages
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("searchcraft: sifter_search returns valid response format", async () => {
    const tool = searchcraftServer.getTool("sifter_search");
    expect(tool).not.toBeNull();

    const result = await tool!.handler({ query: "react" });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 6. Error Handling
// ---------------------------------------------------------------------------

describe("Error Handling", () => {
  let tmpDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpDir = createTmpProjectDir();
    savedEnv.LOCKBOX_KEY = process.env.LOCKBOX_KEY;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (savedEnv.LOCKBOX_KEY === undefined) {
      delete process.env.LOCKBOX_KEY;
    } else {
      process.env.LOCKBOX_KEY = savedEnv.LOCKBOX_KEY;
    }
  });

  it("toolkit: get_package with unknown name returns graceful response (not throw)", async () => {
    const tool = toolkitServer.getTool("get_package");
    const result = await tool!.handler({ name: "nonexistent-package-xyz" });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Unknown");
  });

  it("toolkit: find_package with gibberish returns graceful response", async () => {
    const tool = toolkitServer.getTool("find_package");
    const result = await tool!.handler({ useCase: "zzzzqqqxxx" });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
  });

  it("flagpost: flagpost_add_flag with nonexistent configPath returns graceful response", async () => {
    const tool = flagpostServer.getTool("flagpost_add_flag");
    const result = await tool!.handler({
      configPath: join(tmpDir, "nonexistent.ts"),
      name: "testFlag",
      defaultValue: false,
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not found");
  });

  it("flagpost: flagpost_list_flags with nonexistent configPath returns graceful response", async () => {
    const tool = flagpostServer.getTool("flagpost_list_flags");
    const result = await tool!.handler({
      configPath: join(tmpDir, "nonexistent.ts"),
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not found");
  });

  it("croncall: clocktower_add_job with invalid cron expression returns error response", async () => {
    // First create a config file
    const configPath = join(tmpDir, "croncall.config.ts");
    writeFileSync(configPath, 'import { createClockTower } from "croncall";\nexport const tower = createClockTower({ jobs: {} });\n');

    const tool = croncallServer.getTool("clocktower_add_job");
    const result = await tool!.handler({
      configPath,
      name: "badJob",
      schedule: "not-a-cron",
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    // Should indicate an error, not throw
    expect(result.isError).toBe(true);
  });

  it("croncall: clocktower_schedule with nonexistent config returns error response", async () => {
    const tool = croncallServer.getTool("clocktower_schedule");
    const result = await tool!.handler({
      configPath: join(tmpDir, "nonexistent.ts"),
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.isError).toBe(true);
  });

  it("ratelimit-next: floodgate_add_rule with nonexistent config returns graceful response", async () => {
    const tool = ratelimitServer.getTool("floodgate_add_rule");
    const result = await tool!.handler({
      configPath: join(tmpDir, "nonexistent.ts"),
      name: "test",
      limit: 10,
      window: "1m",
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not found");
  });

  it("shutterbox: darkroom_optimize with nonexistent directory returns graceful response", async () => {
    const tool = shutterboxServer.getTool("darkroom_optimize");
    const result = await tool!.handler({
      directory: join(tmpDir, "nonexistent-dir"),
    });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not found");
  });

  it("searchcraft: sifter_search with no matches returns graceful response", async () => {
    const tool = searchcraftServer.getTool("sifter_search");
    const result = await tool!.handler({ query: "zzzzxxxxxqqqqq" });

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No results");
  });

  it("vaultbox: lockbox_get with missing secret returns error response", async () => {
    process.env.LOCKBOX_KEY = generateKey();

    // Create the .secrets dir so loadStore works
    const secretsDir = join(tmpDir, ".secrets");
    mkdirSync(secretsDir, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      const tool = vaultboxServer.getTool("lockbox_get");
      const result = await tool!.handler({ name: "NONEXISTENT_SECRET" });

      expect(result).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.isError).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Snapshot Stability
// ---------------------------------------------------------------------------

describe("Snapshot Stability", () => {
  it("manifest of all tool names + descriptions across all servers is stable", () => {
    const manifest: Record<string, Array<{ name: string; description: string }>> = {};

    for (const entry of SERVERS) {
      const tools = entry.server.getTools();
      manifest[entry.expectedServerName] = tools
        .map((t) => ({ name: t.name, description: t.description }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    expect(manifest).toMatchSnapshot();
  });
});
