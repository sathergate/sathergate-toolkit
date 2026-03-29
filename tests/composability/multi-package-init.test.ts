import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";
import { server as vaultboxServer } from "../../packages/vaultbox/src/mcp.js";
import { server as searchcraftServer } from "../../packages/searchcraft/src/mcp.js";
import { server as shutterboxServer } from "../../packages/shutterbox/src/mcp.js";
import { server as notifykitServer } from "../../packages/notifykit/src/mcp.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_PKG = JSON.stringify(
  { name: "test-project", dependencies: {} },
  null,
  2,
);

function createTmpProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "composability-init-"));
  writeFileSync(join(dir, "package.json"), MINIMAL_PKG);
  return dir;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. Three-package init
// ---------------------------------------------------------------------------

describe("three-package init", () => {
  it("flagpost, ratelimit-next, and croncall can be initialized in the same directory without conflicts", async () => {
    // Init flagpost
    const flagpostInit = flagpostServer.getTool("flagpost_init");
    const flagpostResult = await flagpostInit!.handler({ projectDir: tmpDir });
    expect(flagpostResult.content[0].text).toContain("Created flagpost.config.ts");

    // Init ratelimit-next
    const floodgateInit = ratelimitServer.getTool("floodgate_init");
    const floodgateResult = await floodgateInit!.handler({ projectDir: tmpDir });
    expect(floodgateResult.content[0].text).toContain("Created floodgate.config.ts");

    // Init croncall
    const clocktowerInit = croncallServer.getTool("clocktower_init");
    const clocktowerResult = await clocktowerInit!.handler({ projectDir: tmpDir });
    expect(clocktowerResult.content[0].text).toContain("Created croncall.config.ts");

    // Verify all 3 config files exist
    expect(existsSync(join(tmpDir, "flagpost.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "floodgate.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "croncall.config.ts"))).toBe(true);

    // Files don't overwrite each other -- each contains its own import
    const flagpostContent = readFileSync(join(tmpDir, "flagpost.config.ts"), "utf-8");
    const floodgateContent = readFileSync(join(tmpDir, "floodgate.config.ts"), "utf-8");
    const croncallContent = readFileSync(join(tmpDir, "croncall.config.ts"), "utf-8");

    expect(flagpostContent).toContain('from "flagpost"');
    expect(floodgateContent).toContain('from "ratelimit-next"');
    expect(croncallContent).toContain('from "croncall"');

    // Each config is distinct -- no cross-contamination
    expect(flagpostContent).not.toContain("createFloodgate");
    expect(floodgateContent).not.toContain("createFlagpost");
    expect(croncallContent).not.toContain("createFlagpost");
  });
});

// ---------------------------------------------------------------------------
// 2. Full toolkit init
// ---------------------------------------------------------------------------

describe("full toolkit init", () => {
  it("all 7 packages can be initialized in one project directory without errors", async () => {
    // Set up env for vaultbox
    process.env.LOCKBOX_KEY = "a".repeat(64);

    const inits: Array<{ server: typeof flagpostServer; tool: string; configOrArtifact: string }> = [
      { server: flagpostServer, tool: "flagpost_init", configOrArtifact: "flagpost.config.ts" },
      { server: searchcraftServer, tool: "sifter_init", configOrArtifact: "searchcraft.config.ts" },
      { server: croncallServer, tool: "clocktower_init", configOrArtifact: "croncall.config.ts" },
      { server: ratelimitServer, tool: "floodgate_init", configOrArtifact: "floodgate.config.ts" },
      { server: shutterboxServer, tool: "darkroom_init", configOrArtifact: "shutterbox.config.ts" },
      { server: notifykitServer, tool: "herald_init", configOrArtifact: "herald.config.ts" },
      { server: vaultboxServer, tool: "lockbox_init", configOrArtifact: ".vaultbox-key" },
    ];

    for (const entry of inits) {
      const tool = entry.server.getTool(entry.tool);
      expect(tool).not.toBeNull();
      const result = await tool!.handler({ projectDir: tmpDir });
      // Should not throw and should return text content
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(typeof result.content[0].text).toBe("string");
    }

    // Verify all config files / directories are created
    expect(existsSync(join(tmpDir, "flagpost.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "searchcraft.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "croncall.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "floodgate.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "shutterbox.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, "herald.config.ts"))).toBe(true);
    expect(existsSync(join(tmpDir, ".vaultbox-key"))).toBe(true);
    expect(existsSync(join(tmpDir, ".secrets"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Progressive adoption
// ---------------------------------------------------------------------------

describe("progressive adoption", () => {
  it("configs created earlier are unchanged when additional packages are initialized", async () => {
    process.env.LOCKBOX_KEY = "b".repeat(64);

    // Step 1: Init vaultbox
    await vaultboxServer.getTool("lockbox_init")!.handler({ projectDir: tmpDir });
    expect(existsSync(join(tmpDir, ".vaultbox-key"))).toBe(true);
    expect(existsSync(join(tmpDir, ".secrets"))).toBe(true);
    const keyAfterStep1 = readFileSync(join(tmpDir, ".vaultbox-key"), "utf-8");

    // Step 2: Init flagpost -- vaultbox artifacts should be untouched
    await flagpostServer.getTool("flagpost_init")!.handler({ projectDir: tmpDir });
    expect(existsSync(join(tmpDir, "flagpost.config.ts"))).toBe(true);
    expect(readFileSync(join(tmpDir, ".vaultbox-key"), "utf-8")).toBe(keyAfterStep1);
    const flagpostAfterStep2 = readFileSync(join(tmpDir, "flagpost.config.ts"), "utf-8");

    // Step 3: Init ratelimit-next -- previous configs untouched
    await ratelimitServer.getTool("floodgate_init")!.handler({ projectDir: tmpDir });
    expect(existsSync(join(tmpDir, "floodgate.config.ts"))).toBe(true);
    expect(readFileSync(join(tmpDir, ".vaultbox-key"), "utf-8")).toBe(keyAfterStep1);
    expect(readFileSync(join(tmpDir, "flagpost.config.ts"), "utf-8")).toBe(flagpostAfterStep2);
    const floodgateAfterStep3 = readFileSync(join(tmpDir, "floodgate.config.ts"), "utf-8");

    // Step 4: Init croncall -- all previous configs untouched
    await croncallServer.getTool("clocktower_init")!.handler({ projectDir: tmpDir });
    expect(existsSync(join(tmpDir, "croncall.config.ts"))).toBe(true);
    expect(readFileSync(join(tmpDir, ".vaultbox-key"), "utf-8")).toBe(keyAfterStep1);
    expect(readFileSync(join(tmpDir, "flagpost.config.ts"), "utf-8")).toBe(flagpostAfterStep2);
    expect(readFileSync(join(tmpDir, "floodgate.config.ts"), "utf-8")).toBe(floodgateAfterStep3);
  });
});
