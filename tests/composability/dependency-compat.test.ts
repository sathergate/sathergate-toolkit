import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { satisfies } from "semver";

import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";
import { server as vaultboxServer } from "../../packages/vaultbox/src/mcp.js";
import { server as searchcraftServer } from "../../packages/searchcraft/src/mcp.js";
import { server as shutterboxServer } from "../../packages/shutterbox/src/mcp.js";
import { server as notifykitServer } from "../../packages/notifykit/src/mcp.js";
import { server as toolkitServer } from "../../packages/toolkit/src/mcp.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = join(__dirname, "..", "..", "packages");

/** Packages that have their own directory with a package.json in this monorepo */
const PACKAGE_DIRS = [
  "flagpost",
  "croncall",
  "ratelimit-next",
  "vaultbox",
  "searchcraft",
  "shutterbox",
  "notifykit",
  "toolkit",
] as const;

function readPkgJson(dir: string): Record<string, unknown> {
  const raw = readFileSync(join(PACKAGES_DIR, dir, "package.json"), "utf-8");
  return JSON.parse(raw);
}

/**
 * Parse a peer dependency range and extract the minimum version number.
 * For ranges like ">=3.25.0" returns "3.25.0", for ">=18" returns "18.0.0".
 */
function extractMinVersion(range: string): string | null {
  const match = range.match(/>=?\s*([\d.]+)/);
  if (!match) return null;
  const ver = match[1];
  // Pad to semver if only major (e.g., "18" -> "18.0.0")
  const parts = ver.split(".");
  while (parts.length < 3) parts.push("0");
  return parts.join(".");
}

// ---------------------------------------------------------------------------
// All servers for tool-name uniqueness checks
// ---------------------------------------------------------------------------

const ALL_SERVERS = [
  { label: "toolkit", server: toolkitServer },
  { label: "flagpost", server: flagpostServer },
  { label: "searchcraft", server: searchcraftServer },
  { label: "vaultbox", server: vaultboxServer },
  { label: "croncall", server: croncallServer },
  { label: "ratelimit-next", server: ratelimitServer },
  { label: "shutterbox", server: shutterboxServer },
  { label: "notifykit", server: notifykitServer },
] as const;

// ---------------------------------------------------------------------------
// Init tool -> config file mapping (for uniqueness checks)
// ---------------------------------------------------------------------------

const INIT_CONFIG_MAP: Record<string, string> = {
  flagpost_init: "flagpost.config.ts",
  sifter_init: "searchcraft.config.ts",
  clocktower_init: "croncall.config.ts",
  floodgate_init: "floodgate.config.ts",
  darkroom_init: "shutterbox.config.ts",
  herald_init: "herald.config.ts",
  lockbox_init: ".vaultbox-key",
};

// ---------------------------------------------------------------------------
// 1. Shared peer deps — compatible version ranges
// ---------------------------------------------------------------------------

describe("shared peer deps", () => {
  const SHARED_DEPS = ["@modelcontextprotocol/server", "zod"] as const;

  it("all packages specify compatible ranges for @modelcontextprotocol/server", () => {
    const ranges: Record<string, string> = {};

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      const peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
      if (peers["@modelcontextprotocol/server"]) {
        ranges[dir] = peers["@modelcontextprotocol/server"];
      }
    }

    // All packages should declare this peer dep
    expect(Object.keys(ranges).length).toBe(PACKAGE_DIRS.length);

    // All ranges should be satisfiable by a single version — extract min versions
    // and verify they are all compatible (the latest min should satisfy all ranges)
    const minVersions = Object.entries(ranges).map(([dir, range]) => ({
      dir,
      range,
      min: extractMinVersion(range),
    }));

    for (const entry of minVersions) {
      expect(entry.min).not.toBeNull();
    }

    // Find the highest minimum version
    const sorted = minVersions
      .filter((e) => e.min !== null)
      .sort((a, b) => (a.min! > b.min! ? -1 : 1));
    const highestMin = sorted[0].min!;

    // This highest minimum version should satisfy every range
    for (const entry of minVersions) {
      expect(
        satisfies(highestMin, entry.range),
        `${entry.dir} range "${entry.range}" is not satisfied by ${highestMin}`,
      ).toBe(true);
    }
  });

  it("all packages specify compatible ranges for zod", () => {
    const ranges: Record<string, string> = {};

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      const peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
      if (peers.zod) {
        ranges[dir] = peers.zod;
      }
    }

    expect(Object.keys(ranges).length).toBe(PACKAGE_DIRS.length);

    const minVersions = Object.entries(ranges).map(([dir, range]) => ({
      dir,
      range,
      min: extractMinVersion(range),
    }));

    for (const entry of minVersions) {
      expect(entry.min).not.toBeNull();
    }

    const sorted = minVersions
      .filter((e) => e.min !== null)
      .sort((a, b) => (a.min! > b.min! ? -1 : 1));
    const highestMin = sorted[0].min!;

    for (const entry of minVersions) {
      expect(
        satisfies(highestMin, entry.range),
        `${entry.dir} range "${entry.range}" is not satisfied by ${highestMin}`,
      ).toBe(true);
    }
  });

  it("packages that declare react peer dep specify compatible ranges", () => {
    const ranges: Record<string, string> = {};

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      const peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
      if (peers.react) {
        ranges[dir] = peers.react;
      }
    }

    // Not all packages need react, but those that do should agree
    expect(Object.keys(ranges).length).toBeGreaterThan(0);

    const minVersions = Object.entries(ranges).map(([dir, range]) => ({
      dir,
      range,
      min: extractMinVersion(range),
    }));

    const sorted = minVersions
      .filter((e) => e.min !== null)
      .sort((a, b) => (a.min! > b.min! ? -1 : 1));
    const highestMin = sorted[0].min!;

    for (const entry of minVersions) {
      expect(
        satisfies(highestMin, entry.range),
        `${entry.dir} range "${entry.range}" is not satisfied by ${highestMin}`,
      ).toBe(true);
    }
  });

  it("packages that declare next peer dep specify compatible ranges", () => {
    const ranges: Record<string, string> = {};

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      const peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
      if (peers.next) {
        ranges[dir] = peers.next;
      }
    }

    expect(Object.keys(ranges).length).toBeGreaterThan(0);

    const minVersions = Object.entries(ranges).map(([dir, range]) => ({
      dir,
      range,
      min: extractMinVersion(range),
    }));

    const sorted = minVersions
      .filter((e) => e.min !== null)
      .sort((a, b) => (a.min! > b.min! ? -1 : 1));
    const highestMin = sorted[0].min!;

    for (const entry of minVersions) {
      expect(
        satisfies(highestMin, entry.range),
        `${entry.dir} range "${entry.range}" is not satisfied by ${highestMin}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. No conflicting exports — unique config filenames
// ---------------------------------------------------------------------------

describe("no conflicting exports", () => {
  it("each init tool creates a unique config file", () => {
    const configFiles = Object.values(INIT_CONFIG_MAP);
    const unique = new Set(configFiles);

    expect(unique.size).toBe(configFiles.length);
  });

  it("no two config filenames collide when normalized", () => {
    const configFiles = Object.values(INIT_CONFIG_MAP);
    const normalized = configFiles.map((f) => f.toLowerCase());
    const unique = new Set(normalized);

    expect(unique.size).toBe(normalized.length);
  });
});

// ---------------------------------------------------------------------------
// 3. Package naming uniqueness
// ---------------------------------------------------------------------------

describe("package naming uniqueness", () => {
  it("all MCP server names are unique", () => {
    const serverNames: string[] = [];

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      const mcpName = pkg.mcpName as string | undefined;
      if (mcpName) {
        serverNames.push(mcpName);
      }
    }

    expect(serverNames.length).toBeGreaterThanOrEqual(PACKAGE_DIRS.length - 1);
    const unique = new Set(serverNames);
    expect(
      unique.size,
      `Duplicate MCP server names found: ${serverNames.filter((n, i) => serverNames.indexOf(n) !== i).join(", ")}`,
    ).toBe(serverNames.length);
  });

  it("all tool names across all servers are unique", () => {
    const allToolNames: Array<{ server: string; tool: string }> = [];

    for (const entry of ALL_SERVERS) {
      const tools = entry.server.getTools();
      for (const tool of tools) {
        allToolNames.push({ server: entry.label, tool: tool.name });
      }
    }

    const nameOnly = allToolNames.map((t) => t.tool);
    const unique = new Set(nameOnly);

    if (unique.size !== nameOnly.length) {
      // Build a helpful error message showing which tools collide
      const seen = new Map<string, string>();
      const dupes: string[] = [];
      for (const entry of allToolNames) {
        if (seen.has(entry.tool)) {
          dupes.push(`"${entry.tool}" in both ${seen.get(entry.tool)} and ${entry.server}`);
        } else {
          seen.set(entry.tool, entry.server);
        }
      }
      expect.fail(`Duplicate tool names found: ${dupes.join("; ")}`);
    }

    expect(unique.size).toBe(nameOnly.length);
  });

  it("npm package names are unique", () => {
    const names: string[] = [];

    for (const dir of PACKAGE_DIRS) {
      const pkg = readPkgJson(dir);
      names.push(pkg.name as string);
    }

    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
