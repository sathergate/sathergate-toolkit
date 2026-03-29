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
  /** File to compare for idempotency (config file or key file) */
  checkFile: string;
}

const PACKAGES: PackageDef[] = [
  {
    label: "flagpost",
    server: flagpostServer,
    initTool: "flagpost_init",
    depName: "flagpost",
    checkFile: "flagpost.config.ts",
  },
  {
    label: "searchcraft",
    server: searchcraftServer,
    initTool: "sifter_init",
    depName: "searchcraft",
    checkFile: "searchcraft.config.ts",
  },
  {
    label: "croncall",
    server: croncallServer,
    initTool: "clocktower_init",
    depName: "croncall",
    checkFile: "croncall.config.ts",
  },
  {
    label: "ratelimit-next",
    server: ratelimitServer,
    initTool: "floodgate_init",
    depName: "ratelimit-next",
    checkFile: "floodgate.config.ts",
  },
  {
    label: "shutterbox",
    server: shutterboxServer,
    initTool: "darkroom_init",
    depName: "shutterbox",
    checkFile: "shutterbox.config.ts",
  },
  {
    label: "notifykit",
    server: notifykitServer,
    initTool: "herald_init",
    depName: "notifykit",
    checkFile: "herald.config.ts",
  },
];

// ---------------------------------------------------------------------------
// Idempotency tests (config-file packages)
// ---------------------------------------------------------------------------

describe("agent-usability: idempotency", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "sathergate-test-"));
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project", dependencies: {} }),
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const pkg of PACKAGES) {
    describe(pkg.label, () => {
      it("second _init call is a no-op that preserves the config", async () => {
        const tool = pkg.server.getTool(pkg.initTool)!;

        // First call — creates the file
        await tool.handler({ projectDir: tmpDir });
        const filePath = join(tmpDir, pkg.checkFile);
        expect(existsSync(filePath)).toBe(true);

        const contentAfterFirst = readFileSync(filePath, "utf-8");

        // Second call — should skip
        const secondResult = await tool.handler({ projectDir: tmpDir });
        const text = secondResult.content[0].text;

        expect(
          text.includes("already exists") || text.includes("Skipping"),
        ).toBe(true);

        // File content must be unchanged
        const contentAfterSecond = readFileSync(filePath, "utf-8");
        expect(contentAfterSecond).toBe(contentAfterFirst);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // vaultbox idempotency
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

    it("second lockbox_init preserves the key file", async () => {
      const tool = vaultboxServer.getTool("lockbox_init")!;

      // First call
      await tool.handler({ projectDir: tmpDir });
      const keyPath = join(tmpDir, ".vaultbox-key");
      expect(existsSync(keyPath)).toBe(true);

      const keyAfterFirst = readFileSync(keyPath, "utf-8");

      // Second call
      const secondResult = await tool.handler({ projectDir: tmpDir });
      const text = secondResult.content[0].text;

      expect(
        text.includes("already exists") || text.includes("Key already"),
      ).toBe(true);

      // Key must not change
      const keyAfterSecond = readFileSync(keyPath, "utf-8");
      expect(keyAfterSecond).toBe(keyAfterFirst);
    });
  });
});
