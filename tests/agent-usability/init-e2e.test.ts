import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as searchcraftServer } from "../../packages/searchcraft/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";
import { server as shutterboxServer } from "../../packages/shutterbox/src/mcp.js";
import { server as notifykitServer } from "../../packages/notifykit/src/mcp.js";
import { server as vaultboxServer } from "../../packages/vaultbox/src/mcp.js";

// ---------------------------------------------------------------------------
// Package definitions
// ---------------------------------------------------------------------------

interface PackageDef {
  label: string;
  server: typeof flagpostServer;
  initTool: string;
  depName: string;
  configFile: string;
  /** For most packages the config should contain an import from the package */
  expectedImport?: string;
}

const PACKAGES: PackageDef[] = [
  {
    label: "flagpost",
    server: flagpostServer,
    initTool: "flagpost_init",
    depName: "flagpost",
    configFile: "flagpost.config.ts",
    expectedImport: "flagpost",
  },
  {
    label: "searchcraft",
    server: searchcraftServer,
    initTool: "sifter_init",
    depName: "searchcraft",
    configFile: "searchcraft.config.ts",
    expectedImport: "searchcraft",
  },
  {
    label: "croncall",
    server: croncallServer,
    initTool: "clocktower_init",
    depName: "croncall",
    configFile: "croncall.config.ts",
    expectedImport: "croncall",
  },
  {
    label: "ratelimit-next",
    server: ratelimitServer,
    initTool: "floodgate_init",
    depName: "ratelimit-next",
    configFile: "floodgate.config.ts",
    expectedImport: "ratelimit-next",
  },
  {
    label: "shutterbox",
    server: shutterboxServer,
    initTool: "darkroom_init",
    depName: "shutterbox",
    configFile: "shutterbox.config.ts",
    expectedImport: "shutterbox",
  },
  {
    label: "notifykit",
    server: notifykitServer,
    initTool: "herald_init",
    depName: "notifykit",
    configFile: "herald.config.ts",
    expectedImport: "notifykit",
  },
];

// ---------------------------------------------------------------------------
// Standard init tests (config-file packages)
// ---------------------------------------------------------------------------

describe("agent-usability: init e2e", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "sathergate-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const pkg of PACKAGES) {
    describe(pkg.label, () => {
      it("scaffolds config file via _init tool", async () => {
        // Write a minimal package.json so the init tool can detect the dep
        writeFileSync(
          join(tmpDir, "package.json"),
          JSON.stringify({
            name: "test-project",
            dependencies: { [pkg.depName]: "0.1.0" },
          }),
        );

        const tool = pkg.server.getTool(pkg.initTool);
        expect(tool).not.toBeNull();

        const result = await tool!.handler({ projectDir: tmpDir });
        const text = result.content[0].text;

        // Response should mention creation or next steps
        expect(
          text.includes("Created") || text.includes("Next steps"),
        ).toBe(true);

        // Config file should exist
        const configPath = join(tmpDir, pkg.configFile);
        expect(existsSync(configPath)).toBe(true);

        // Config file should be non-empty and contain expected import
        const content = readFileSync(configPath, "utf-8");
        expect(content.length).toBeGreaterThan(0);

        if (pkg.expectedImport) {
          expect(content).toContain(pkg.expectedImport);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // vaultbox — special case: creates key file and .secrets/ directory
  // ---------------------------------------------------------------------------

  describe("vaultbox", () => {
    const savedEnv = process.env["LOCKBOX_KEY"];

    beforeEach(() => {
      process.env["LOCKBOX_KEY"] = "a".repeat(64);
    });

    afterEach(() => {
      if (savedEnv === undefined) {
        delete process.env["LOCKBOX_KEY"];
      } else {
        process.env["LOCKBOX_KEY"] = savedEnv;
      }
    });

    it("scaffolds .vaultbox-key and .secrets/ via lockbox_init", async () => {
      writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({
          name: "test-project",
          dependencies: { vaultbox: "0.1.0" },
        }),
      );

      const tool = vaultboxServer.getTool("lockbox_init");
      expect(tool).not.toBeNull();

      const result = await tool!.handler({ projectDir: tmpDir });
      const text = result.content[0].text;

      // Should mention key generation or next steps
      expect(
        text.includes("Generated") ||
          text.includes("Next steps") ||
          text.includes("key"),
      ).toBe(true);

      // .vaultbox-key should exist
      expect(existsSync(join(tmpDir, ".vaultbox-key"))).toBe(true);

      // .secrets/ directory should exist
      expect(existsSync(join(tmpDir, ".secrets"))).toBe(true);

      // Key file should be non-empty
      const keyContent = readFileSync(
        join(tmpDir, ".vaultbox-key"),
        "utf-8",
      );
      expect(keyContent.trim().length).toBeGreaterThan(0);
    });
  });
});
