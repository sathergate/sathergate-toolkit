import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "node:crypto";
import type { EncryptedEnvelope } from "./types.js";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 16;
const SALT_BYTES = 32;
const KEY_BYTES = 32;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha512";

/**
 * Generate a random 32-byte encryption key as a hex string.
 */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("hex");
}

/**
 * Derive a 32-byte key from a master key hex string and a salt buffer
 * using PBKDF2-SHA512.
 */
export function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    Buffer.from(masterKey, "hex"),
    salt,
    PBKDF2_ITERATIONS,
    KEY_BYTES,
    PBKDF2_DIGEST,
  );
}

/**
 * Encrypt plaintext using AES-256-GCM with PBKDF2 key derivation.
 * Each call uses a fresh random IV and salt.
 */
export function encrypt(plaintext: string, key: string): EncryptedEnvelope {
  const iv = randomBytes(IV_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const derived = deriveKey(key, salt);

  const cipher = createCipheriv(ALGORITHM, derived, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString("hex"),
    salt: salt.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted envelope.
 */
export function decrypt(envelope: EncryptedEnvelope, key: string): string {
  const iv = Buffer.from(envelope.iv, "hex");
  const salt = Buffer.from(envelope.salt, "hex");
  const ciphertext = Buffer.from(envelope.ciphertext, "hex");
  const tag = Buffer.from(envelope.tag, "hex");
  const derived = deriveKey(key, salt);

  const decipher = createDecipheriv(ALGORITHM, derived, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
