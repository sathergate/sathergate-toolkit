import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { server as flagpostServer } from "../../packages/flagpost/src/mcp.js";
import { server as croncallServer } from "../../packages/croncall/src/mcp.js";
import { server as ratelimitServer } from "../../packages/ratelimit-next/src/mcp.js";

// ---------------------------------------------------------------------------
// Config modification tests — verifying add/modify tools work after init
// ---------------------------------------------------------------------------

describe("agent-usability: config modification", () => {
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
  // flagpost: init -> add flag -> list flags
  // -------------------------------------------------------------------------

  describe("flagpost: add and list flags", () => {
    it("adds a flag and lists it back", async () => {
      // Step 1: Init
      const initTool = flagpostServer.getTool("flagpost_init")!;
      await initTool.handler({ projectDir: tmpDir });

      const configPath = join(tmpDir, "flagpost.config.ts");

      // Step 2: Add a flag
      const addTool = flagpostServer.getTool("flagpost_add_flag")!;
      const addResult = await addTool.handler({
        configPath,
        name: "darkMode",
        defaultValue: true,
      });
      const addText = addResult.content[0].text;
      expect(addText).toContain("darkMode");

      // Step 3: List flags — should include darkMode
      const listTool = flagpostServer.getTool("flagpost_list_flags")!;
      const listResult = await listTool.handler({ configPath });
      const listText = listResult.content[0].text;

      expect(listText).toContain("darkMode");
      expect(listText).toContain("true");
    });
  });

  // -------------------------------------------------------------------------
  // croncall: init -> add job -> schedule
  // -------------------------------------------------------------------------

  describe("croncall: add job and view schedule", () => {
    it("adds a cron job and shows it in the schedule", async () => {
      // Step 1: Init
      const initTool = croncallServer.getTool("clocktower_init")!;
      await initTool.handler({ projectDir: tmpDir });

      const configPath = join(tmpDir, "croncall.config.ts");

      // Step 2: Add a job
      const addTool = croncallServer.getTool("clocktower_add_job")!;
      const addResult = await addTool.handler({
        configPath,
        name: "syncUsers",
        schedule: "0 * * * *",
      });
      const addText = addResult.content[0].text;
      expect(addText).toContain("syncUsers");

      // Step 3: View schedule — should include syncUsers
      const scheduleTool = croncallServer.getTool("clocktower_schedule")!;
      const scheduleResult = await scheduleTool.handler({ configPath });
      const scheduleText = scheduleResult.content[0].text;

      expect(scheduleText).toContain("syncUsers");
    });
  });

  // -------------------------------------------------------------------------
  // ratelimit-next: init -> add rule -> verify in config
  // -------------------------------------------------------------------------

  describe("ratelimit-next: add rate limit rule", () => {
    it("adds a rule that appears in the config file", async () => {
      // Step 1: Init
      const initTool = ratelimitServer.getTool("floodgate_init")!;
      await initTool.handler({ projectDir: tmpDir });

      const configPath = join(tmpDir, "floodgate.config.ts");

      // Step 2: Add a rule
      const addTool = ratelimitServer.getTool("floodgate_add_rule")!;
      const addResult = await addTool.handler({
        configPath,
        name: "upload",
        limit: 10,
        window: "1h",
      });
      const addText = addResult.content[0].text;
      expect(addText).toContain("upload");

      // Step 3: Read the config and verify the rule is present
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("upload");
      expect(content).toContain("10");
      expect(content).toContain("1h");
    });
  });
});
