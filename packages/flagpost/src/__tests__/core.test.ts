import { describe, it, expect } from "vitest";
import { createFlagpost } from "../core/flagpost.js";

describe("createFlagpost", () => {
  const fp = createFlagpost({
    flags: {
      darkMode: { defaultValue: false },
      banner: {
        defaultValue: "default",
        rules: [
          { value: "vip", match: { plan: "enterprise" } },
          { value: "beta", match: { beta: true } },
        ],
      },
      rollout: {
        defaultValue: false,
        rules: [{ value: true, percentage: 50 }],
      },
      variant: {
        defaultValue: "control",
        rules: [
          { value: "a", match: { group: "a" } },
          { value: "b", match: { group: "b" } },
        ],
      },
    },
  });

  describe("evaluate", () => {
    it("returns defaultValue when no rules match", () => {
      expect(fp.evaluate("darkMode")).toBe(false);
      expect(fp.evaluate("banner")).toBe("default");
    });

    it("matches rules with match object", () => {
      expect(fp.evaluate("banner", { plan: "enterprise" })).toBe("vip");
      expect(fp.evaluate("banner", { beta: true })).toBe("beta");
    });

    it("returns defaultValue when match object does not match", () => {
      expect(fp.evaluate("banner", { plan: "free" })).toBe("default");
    });

    it("first matching rule wins (order matters)", () => {
      const ordered = createFlagpost({
        flags: {
          priority: {
            defaultValue: "none",
            rules: [
              { value: "first", match: { role: "admin" } },
              { value: "second", match: { role: "admin" } },
            ],
          },
        },
      });
      expect(ordered.evaluate("priority", { role: "admin" })).toBe("first");
    });
  });

  describe("percentage rollout", () => {
    it("is deterministic (same userId always gets same result)", () => {
      const result1 = fp.evaluate("rollout", { userId: "user-42" });
      const result2 = fp.evaluate("rollout", { userId: "user-42" });
      const result3 = fp.evaluate("rollout", { userId: "user-42" });
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("returns defaultValue when no userId is provided", () => {
      expect(fp.evaluate("rollout", {})).toBe(false);
    });

    it("distributes roughly correctly for 50% rollout", () => {
      let enabled = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        const val = fp.evaluate("rollout", { userId: `user-${i}` });
        if (val === true) enabled++;
      }
      // Allow reasonable variance: 50% +/- 15%
      expect(enabled).toBeGreaterThan(total * 0.35);
      expect(enabled).toBeLessThan(total * 0.65);
    });
  });

  describe("isEnabled", () => {
    it("returns boolean for boolean flags", () => {
      expect(fp.isEnabled("darkMode")).toBe(false);
    });

    it("returns false for non-boolean flag values", () => {
      expect(fp.isEnabled("banner")).toBe(false);
    });
  });

  describe("evaluateAll", () => {
    it("returns all flag values with defaults", () => {
      const all = fp.evaluateAll();
      expect(all).toEqual({
        darkMode: false,
        banner: "default",
        rollout: false,
        variant: "control",
      });
    });

    it("applies context to all flags", () => {
      const all = fp.evaluateAll({ plan: "enterprise" });
      expect(all.banner).toBe("vip");
    });
  });

  describe("definitions", () => {
    it("exposes the flag definitions", () => {
      expect(fp.definitions).toHaveProperty("darkMode");
      expect(fp.definitions.darkMode.defaultValue).toBe(false);
    });
  });
});
