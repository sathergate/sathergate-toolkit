import { describe, it, expect } from "vitest";
import { parseCron, matchesCron, nextRun } from "../core/cron.js";

describe("parseCron", () => {
  it('parses "* * * * *" (every minute)', () => {
    const cron = parseCron("* * * * *");
    expect(cron.minutes.size).toBe(60);
    expect(cron.hours.size).toBe(24);
    expect(cron.daysOfMonth.size).toBe(31);
    expect(cron.months.size).toBe(12);
    expect(cron.daysOfWeek.size).toBe(7);
  });

  it('handles @hourly shortcut ("0 * * * *")', () => {
    const cron = parseCron("@hourly");
    expect(cron.minutes.size).toBe(1);
    expect(cron.minutes.has(0)).toBe(true);
    expect(cron.hours.size).toBe(24);
  });

  it('handles @daily shortcut ("0 0 * * *")', () => {
    const cron = parseCron("@daily");
    expect(cron.minutes.has(0)).toBe(true);
    expect(cron.hours.has(0)).toBe(true);
    expect(cron.minutes.size).toBe(1);
    expect(cron.hours.size).toBe(1);
  });

  it('handles @monthly shortcut ("0 0 1 * *")', () => {
    const cron = parseCron("@monthly");
    expect(cron.daysOfMonth.size).toBe(1);
    expect(cron.daysOfMonth.has(1)).toBe(true);
  });

  it('handles @weekly shortcut ("0 0 * * 0")', () => {
    const cron = parseCron("@weekly");
    expect(cron.daysOfWeek.size).toBe(1);
    expect(cron.daysOfWeek.has(0)).toBe(true);
  });

  it("handles ranges (e.g. 0-5)", () => {
    const cron = parseCron("0-5 * * * *");
    expect(cron.minutes.size).toBe(6);
    for (let i = 0; i <= 5; i++) {
      expect(cron.minutes.has(i)).toBe(true);
    }
  });

  it("handles steps (e.g. */15)", () => {
    const cron = parseCron("*/15 * * * *");
    expect(cron.minutes.has(0)).toBe(true);
    expect(cron.minutes.has(15)).toBe(true);
    expect(cron.minutes.has(30)).toBe(true);
    expect(cron.minutes.has(45)).toBe(true);
    expect(cron.minutes.size).toBe(4);
  });

  it("handles lists (e.g. 1,3,5)", () => {
    const cron = parseCron("1,3,5 * * * *");
    expect(cron.minutes.size).toBe(3);
    expect(cron.minutes.has(1)).toBe(true);
    expect(cron.minutes.has(3)).toBe(true);
    expect(cron.minutes.has(5)).toBe(true);
  });

  it("throws on invalid cron expression", () => {
    expect(() => parseCron("not a cron")).toThrow();
    expect(() => parseCron("* * *")).toThrow();
    expect(() => parseCron("")).toThrow();
  });
});

describe("matchesCron", () => {
  it("returns true when date matches expression", () => {
    // 2025-01-15 10:30 UTC is a Wednesday (day 3)
    const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    expect(matchesCron("30 10 15 1 3", date)).toBe(true);
    expect(matchesCron("* * * * *", date)).toBe(true);
  });

  it("returns false when date does not match minute", () => {
    const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    expect(matchesCron("0 10 15 1 3", date)).toBe(false);
  });

  it("returns false when date does not match hour", () => {
    const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    expect(matchesCron("30 11 15 1 3", date)).toBe(false);
  });

  it("returns false when date does not match day of week", () => {
    const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    expect(matchesCron("30 10 15 1 1", date)).toBe(false);
  });

  it("matches @daily at midnight UTC", () => {
    const midnight = new Date(Date.UTC(2025, 5, 1, 0, 0, 0));
    expect(matchesCron("@daily", midnight)).toBe(true);
  });

  it("does not match @daily at non-midnight", () => {
    const noon = new Date(Date.UTC(2025, 5, 1, 12, 0, 0));
    expect(matchesCron("@daily", noon)).toBe(false);
  });
});

describe("nextRun", () => {
  it("returns the correct next execution time", () => {
    const after = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    const next = nextRun("0 11 * * *", after);
    expect(next.getUTCHours()).toBe(11);
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getUTCDate()).toBe(15);
  });

  it("@hourly returns the top of the next hour", () => {
    const after = new Date(Date.UTC(2025, 0, 15, 10, 45, 0));
    const next = nextRun("@hourly", after);
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getUTCHours()).toBe(11);
  });

  it("advances to the next day when no more matches today", () => {
    const after = new Date(Date.UTC(2025, 0, 15, 23, 30, 0));
    const next = nextRun("@daily", after);
    expect(next.getUTCDate()).toBe(16);
    expect(next.getUTCHours()).toBe(0);
    expect(next.getUTCMinutes()).toBe(0);
  });

  it("handles */15 minute intervals", () => {
    const after = new Date(Date.UTC(2025, 0, 15, 10, 16, 0));
    const next = nextRun("*/15 * * * *", after);
    expect(next.getUTCMinutes()).toBe(30);
    expect(next.getUTCHours()).toBe(10);
  });

  it("returns a future date (never the same minute)", () => {
    const after = new Date(Date.UTC(2025, 0, 15, 10, 0, 0));
    const next = nextRun("0 10 * * *", after);
    expect(next.getTime()).toBeGreaterThan(after.getTime());
  });
});
