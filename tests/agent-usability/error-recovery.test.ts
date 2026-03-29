import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";
import { server as searchcraftServer } from "../../packages/searchcraft/src/mcp.js";
import { server as shutterboxServer } from "../../packages/shutterbox/src/mcp.js";
import { server as notifykitServer } from "../../packages/notifykit/src/mcp.js";
import { server as vaultboxServer } from "../../packages/vaultbox/src/mcp.js";

// ---------------------------------------------------------------------------
// Error recovery tests — verify tools give actionable error messages
// ---------------------------------------------------------------------------

describe("agent-usability: error recovery", () => {
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

  // -------------------------------------------------------------------------
  // 1. _init tools with a nonexistent directory
  // -------------------------------------------------------------------------

  describe("init with nonexistent directory", () => {
    const initTools = [
      { label: "flagpost", server: flagpostServer, tool: "flagpost_init" },
      { label: "searchcraft", server: searchcraftServer, tool: "sifter_init" },
      { label: "croncall", server: croncallServer, tool: "clocktower_init" },
      { label: "ratelimit-next", server: ratelimitServer, tool: "floodgate_init" },
      { label: "shutterbox", server: shutterboxServer, tool: "darkroom_init" },
      { label: "notifykit", server: notifykitServer, tool: "herald_init" },
    ];

    for (const pkg of initTools) {
      it(`${pkg.label}: signals error for nonexistent directory`, async () => {
        const tool = pkg.server.getTool(pkg.tool)!;
        const bogusDir = join(tmpDir, "does", "not", "exist");

        // Tools may either return an error response or throw — both are acceptable
        // as long as the agent gets a clear signal that something went wrong.
        try {
          const result = await tool.handler({ projectDir: bogusDir });
          const text = result.content[0].text;
          const isErrorResponse =
            result.isError === true ||
            /error|not found|does not exist|no such|cannot|invalid|warning/i.test(text);
          expect(isErrorResponse).toBe(true);
        } catch (err: any) {
          // Thrown errors (e.g. ENOENT) are also valid error signals
          expect(err).toBeDefined();
          expect(err.message || err.code).toBeTruthy();
        }
      });
    }

    it("vaultbox: signals error for nonexistent directory", async () => {
      const savedEnv = process.env["LOCKBOX_KEY"];
      process.env["LOCKBOX_KEY"] = "a".repeat(64);

      try {
        const tool = vaultboxServer.getTool("lockbox_init")!;
        const bogusDir = join(tmpDir, "does", "not", "exist");

        try {
          const result = await tool.handler({ projectDir: bogusDir });
          const text = result.content[0].text;
          const isErrorResponse =
            result.isError === true ||
            /error|not found|does not exist|no such|cannot|invalid|warning/i.test(text);
          expect(isErrorResponse).toBe(true);
        } catch (err: any) {
          expect(err).toBeDefined();
          expect(err.message || err.code).toBeTruthy();
        }
      } finally {
        if (savedEnv === undefined) {
          delete process.env["LOCKBOX_KEY"];
        } else {
          process.env["LOCKBOX_KEY"] = savedEnv;
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. _add_* tools when config doesn't exist
  // -------------------------------------------------------------------------

  describe("add tools without prior init", () => {
    it("flagpost_add_flag without init mentions running init first", async () => {
      const addTool = flagpostServer.getTool("flagpost_add_flag")!;
      const configPath = join(tmpDir, "flagpost.config.ts");

      const result = await addTool.handler({
        configPath,
        name: "darkMode",
        defaultValue: true,
      });
      const text = result.content[0].text;

      const mentionsInit =
        result.isError === true ||
        /init first|not found|does not exist|run.*init|missing|no config/i.test(
          text,
        );
      expect(mentionsInit).toBe(true);
    });

    it("clocktower_add_job without init mentions running init first", async () => {
      const addTool = croncallServer.getTool("clocktower_add_job")!;
      const configPath = join(tmpDir, "croncall.config.ts");

      const result = await addTool.handler({
        configPath,
        name: "syncUsers",
        schedule: "0 * * * *",
      });
      const text = result.content[0].text;

      const mentionsInit =
        result.isError === true ||
        /init first|not found|does not exist|run.*init|missing|no config/i.test(
          text,
        );
      expect(mentionsInit).toBe(true);
    });

    it("floodgate_add_rule without init mentions running init first", async () => {
      const addTool = ratelimitServer.getTool("floodgate_add_rule")!;
      const configPath = join(tmpDir, "floodgate.config.ts");

      const result = await addTool.handler({
        configPath,
        name: "upload",
        limit: 10,
        window: "1h",
      });
      const text = result.content[0].text;

      const mentionsInit =
        result.isError === true ||
        /init first|not found|does not exist|run.*init|missing|no config/i.test(
          text,
        );
      expect(mentionsInit).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Invalid cron expression
  // -------------------------------------------------------------------------

  describe("invalid cron expression", () => {
    it("clocktower_add_job rejects an invalid cron schedule", async () => {
      // First init so the config exists
      const initTool = croncallServer.getTool("clocktower_init")!;
      await initTool.handler({ projectDir: tmpDir });

      const configPath = join(tmpDir, "croncall.config.ts");
      const addTool = croncallServer.getTool("clocktower_add_job")!;

      const result = await addTool.handler({
        configPath,
        name: "badJob",
        schedule: "not a cron expression",
      });

      // Must signal an error
      expect(result.isError).toBe(true);

      const text = result.content[0].text;
      // Should explain what went wrong with the cron expression
      expect(
        /invalid|cron|schedule|format|syntax|parse/i.test(text),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. flagpost_list_flags on nonexistent config
  // -------------------------------------------------------------------------

  describe("list on nonexistent config", () => {
    it("flagpost_list_flags returns an appropriate error", async () => {
      const listTool = flagpostServer.getTool("flagpost_list_flags")!;
      const configPath = join(tmpDir, "flagpost.config.ts");

      const result = await listTool.handler({ configPath });
      const text = result.content[0].text;

      const isErrorResponse =
        result.isError === true ||
        /not found|does not exist|no such|missing|no config|run.*init/i.test(
          text,
        );
      expect(isErrorResponse).toBe(true);
    });
  });
});
