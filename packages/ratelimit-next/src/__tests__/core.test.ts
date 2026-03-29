import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseWindow } from "../core/algorithms.js";
import { MemoryStore } from "../core/store.js";
import { createFloodgate } from "../core/floodgate.js";
import { RateLimitError } from "../core/types.js";

describe("parseWindow", () => {
  it('converts "1s" to 1000', () => {
    expect(parseWindow("1s")).toBe(1000);
  });

  it('converts "1m" to 60000', () => {
    expect(parseWindow("1m")).toBe(60_000);
  });

  it('converts "1h" to 3600000', () => {
    expect(parseWindow("1h")).toBe(3_600_000);
  });

  it('converts "1d" to 86400000', () => {
    expect(parseWindow("1d")).toBe(86_400_000);
  });

  it('converts "30s" to 30000', () => {
    expect(parseWindow("30s")).toBe(30_000);
  });

  it("throws on invalid format", () => {
    expect(() => parseWindow("abc")).toThrow();
    expect(() => parseWindow("10x")).toThrow();
    expect(() => parseWindow("")).toThrow();
  });
});

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(() => {
    store.destroy();
  });

  it("get returns null for missing keys", async () => {
    expect(await store.get("nonexistent")).toBeNull();
  });

  it("set/get roundtrip works", async () => {
    await store.set("key1", "value1", 10_000);
    expect(await store.get("key1")).toBe("value1");
  });

  it("increment returns incrementing values", async () => {
    expect(await store.increment("counter", 10_000)).toBe(1);
    expect(await store.increment("counter", 10_000)).toBe(2);
    expect(await store.increment("counter", 10_000)).toBe(3);
  });

  it("respects TTL (expired values return null)", async () => {
    await store.set("expiring", "value", 50);
    expect(await store.get("expiring")).toBe("value");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await store.get("expiring")).toBeNull();
  });

  it("increment resets after TTL expiration", async () => {
    await store.increment("counter", 50);
    await store.increment("counter", 50);
    expect(await store.increment("counter", 50)).toBe(3);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await store.increment("counter", 50)).toBe(1);
  });
});

describe("createFloodgate", () => {
  it("check allows requests under limit", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 5, window: "1m", algorithm: "fixed-window" },
      },
    });

    const result = await gate.check("api", "user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.limit).toBe(5);

    (gate.store as MemoryStore).destroy();
  });

  it("check blocks when limit exceeded", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 3, window: "1m", algorithm: "fixed-window" },
      },
    });

    await gate.check("api", "user1");
    await gate.check("api", "user1");
    await gate.check("api", "user1");

    const result = await gate.check("api", "user1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);

    (gate.store as MemoryStore).destroy();
  });

  it("headers returns correct header format", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 10, window: "1m", algorithm: "fixed-window" },
      },
    });

    const result = await gate.check("api", "user1");
    const headers = gate.headers(result);

    expect(headers).toHaveProperty("X-RateLimit-Limit", "10");
    expect(headers).toHaveProperty("X-RateLimit-Remaining");
    expect(headers).toHaveProperty("X-RateLimit-Reset");

    (gate.store as MemoryStore).destroy();
  });

  it("headers includes Retry-After when blocked", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 1, window: "1m", algorithm: "fixed-window" },
      },
    });

    await gate.check("api", "user1");
    const blocked = await gate.check("api", "user1");
    const headers = gate.headers(blocked);

    expect(headers).toHaveProperty("Retry-After");

    (gate.store as MemoryStore).destroy();
  });

  it("limit throws RateLimitError when blocked", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 1, window: "1m", algorithm: "fixed-window" },
      },
    });

    await gate.limit("api", "user1");

    await expect(gate.limit("api", "user1")).rejects.toThrow(RateLimitError);

    (gate.store as MemoryStore).destroy();
  });

  it("limit returns result when allowed", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 10, window: "1m", algorithm: "fixed-window" },
      },
    });

    const result = await gate.limit("api", "user1");
    expect(result.allowed).toBe(true);

    (gate.store as MemoryStore).destroy();
  });

  it("different keys have independent limits", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 1, window: "1m", algorithm: "fixed-window" },
      },
    });

    const r1 = await gate.check("api", "user-a");
    const r2 = await gate.check("api", "user-b");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);

    (gate.store as MemoryStore).destroy();
  });

  it("throws on unknown rule name", async () => {
    const gate = createFloodgate({
      rules: {
        api: { limit: 10, window: "1m" },
      },
    });

    await expect(gate.check("nonexistent")).rejects.toThrow("Unknown rate limit rule");

    (gate.store as MemoryStore).destroy();
  });
});
