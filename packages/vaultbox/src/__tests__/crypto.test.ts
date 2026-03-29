import { describe, it, expect } from "vitest";
import { generateKey, encrypt, decrypt } from "../core/crypto.js";

describe("generateKey", () => {
  it("returns a 64-char hex string (32 bytes)", () => {
    const key = generateKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keys each time", () => {
    const key1 = generateKey();
    const key2 = generateKey();
    expect(key1).not.toBe(key2);
  });
});

describe("encrypt / decrypt", () => {
  it("roundtrip preserves plaintext", () => {
    const key = generateKey();
    const plaintext = "hello world";
    const envelope = encrypt(plaintext, key);
    const result = decrypt(envelope, key);
    expect(result).toBe(plaintext);
  });

  it("envelope has correct structure", () => {
    const key = generateKey();
    const envelope = encrypt("test", key);

    expect(envelope.version).toBe(1);
    expect(envelope.algorithm).toBe("aes-256-gcm");
    expect(typeof envelope.iv).toBe("string");
    expect(typeof envelope.salt).toBe("string");
    expect(typeof envelope.ciphertext).toBe("string");
    expect(typeof envelope.tag).toBe("string");

    // IV is 16 bytes = 32 hex chars
    expect(envelope.iv).toMatch(/^[0-9a-f]{32}$/);
    // Salt is 32 bytes = 64 hex chars
    expect(envelope.salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different encryptions of same plaintext produce different ciphertexts", () => {
    const key = generateKey();
    const envelope1 = encrypt("same text", key);
    const envelope2 = encrypt("same text", key);

    expect(envelope1.iv).not.toBe(envelope2.iv);
    expect(envelope1.salt).not.toBe(envelope2.salt);
    expect(envelope1.ciphertext).not.toBe(envelope2.ciphertext);
  });

  it("decrypt with wrong key throws", () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const envelope = encrypt("secret", key1);

    expect(() => decrypt(envelope, key2)).toThrow();
  });

  it("handles empty string", () => {
    const key = generateKey();
    const envelope = encrypt("", key);
    const result = decrypt(envelope, key);
    expect(result).toBe("");
  });

  it("handles unicode", () => {
    const key = generateKey();
    const plaintext = "Hello \u4e16\u754c \ud83c\udf0d \u00e9\u00e0\u00fc\u00f1";
    const envelope = encrypt(plaintext, key);
    const result = decrypt(envelope, key);
    expect(result).toBe(plaintext);
  });

  it("handles long plaintext", () => {
    const key = generateKey();
    const plaintext = "x".repeat(100_000);
    const envelope = encrypt(plaintext, key);
    const result = decrypt(envelope, key);
    expect(result).toBe(plaintext);
  });
});
