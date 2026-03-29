import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import {
  generateKey,
  encrypt as cryptoEncrypt,
  decrypt as cryptoDecrypt,
} from "./crypto.js";
import type {
  LockboxConfig,
  LockboxInstance,
  EncryptedEnvelope,
} from "./types.js";

const DEFAULT_KEY_PATH = ".vaultbox-key";
const DEFAULT_SECRETS_DIR = ".secrets";

function resolveConfig(config?: LockboxConfig) {
  return {
    keyPath: config?.keyPath ?? DEFAULT_KEY_PATH,
    secretsDir: config?.secretsDir ?? DEFAULT_SECRETS_DIR,
  };
}

function loadKey(keyPath: string): string {
  const envKey = process.env["LOCKBOX_KEY"];
  if (envKey) return envKey.trim();

  if (!existsSync(keyPath)) {
    throw new Error(
      `Lockbox key not found. Set LOCKBOX_KEY env var or run "lockbox init" to create ${keyPath}`,
    );
  }
  return readFileSync(keyPath, "utf8").trim();
}

function getEnvFilePath(secretsDir: string, environment: string): string {
  return join(secretsDir, `${environment}.json`);
}

/**
 * Create a lockbox instance for reading encrypted secrets.
 *
 * Loads the encryption key from `.vaultbox-key` or `LOCKBOX_KEY` env var,
 * then reads encrypted secrets from `.secrets/{NODE_ENV}.json`.
 */
export function createLockbox(config?: LockboxConfig): LockboxInstance {
  const { keyPath, secretsDir } = resolveConfig(config);
  const key = loadKey(keyPath);
  const environment = process.env["NODE_ENV"] ?? "development";

  let cache: Record<string, string> | null = null;

  function loadSecrets(): Record<string, string> {
    if (cache) return cache;

    const filePath = getEnvFilePath(secretsDir, environment);
    if (!existsSync(filePath)) {
      cache = {};
      return cache;
    }

    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as {
      secrets: Record<string, EncryptedEnvelope>;
    };
    const decrypted: Record<string, string> = {};

    for (const [name, envelope] of Object.entries(data.secrets)) {
      decrypted[name] = cryptoDecrypt(envelope, key);
    }

    cache = decrypted;
    return cache;
  }

  return {
    encrypt(plaintext: string): EncryptedEnvelope {
      return cryptoEncrypt(plaintext, key);
    },

    decrypt(envelope: EncryptedEnvelope): string {
      return cryptoDecrypt(envelope, key);
    },

    secret(name: string): string | undefined {
      return loadSecrets()[name];
    },

    secrets(): Record<string, string> {
      return { ...loadSecrets() };
    },

    require(name: string): string {
      const value = loadSecrets()[name];
      if (value === undefined) {
        throw new Error(
          `Secret "${name}" not found in ${environment} environment`,
        );
      }
      return value;
    },

    rotate(): string {
      const newKey = generateKey();

      if (!existsSync(secretsDir)) return newKey;

      let files: string[];
      try {
        files = readdirSync(secretsDir).filter((f) => f.endsWith(".json"));
      } catch {
        files = [];
      }

      for (const file of files) {
        const filePath = join(secretsDir, file);
        const raw = readFileSync(filePath, "utf8");
        const data = JSON.parse(raw) as {
          secrets: Record<string, EncryptedEnvelope>;
        };

        const reEncrypted: Record<string, EncryptedEnvelope> = {};
        for (const [name, envelope] of Object.entries(data.secrets)) {
          const plaintext = cryptoDecrypt(envelope, key);
          reEncrypted[name] = cryptoEncrypt(plaintext, newKey);
        }

        writeFileSync(
          filePath,
          JSON.stringify({ secrets: reEncrypted }, null, 2) + "\n",
        );
      }

      writeFileSync(keyPath, newKey + "\n");
      cache = null;

      return newKey;
    },
  };
}
