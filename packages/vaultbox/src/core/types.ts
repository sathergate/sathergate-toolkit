/** Configuration for a lockbox instance. */
export interface LockboxConfig {
  /** Path to the encryption key file. Default: ".vaultbox-key" */
  keyPath?: string;
  /** Directory where encrypted secret files are stored. Default: ".secrets/" */
  secretsDir?: string;
}

/** AES-256-GCM encrypted envelope stored on disk. */
export interface EncryptedEnvelope {
  /** Envelope format version. */
  version: 1;
  /** Encryption algorithm identifier. */
  algorithm: "aes-256-gcm";
  /** Initialization vector, hex-encoded. */
  iv: string;
  /** PBKDF2 salt, hex-encoded. */
  salt: string;
  /** Ciphertext, hex-encoded. */
  ciphertext: string;
  /** GCM authentication tag, hex-encoded. */
  tag: string;
}

/** Decrypted secret store for a single environment. */
export interface SecretStore {
  /** Environment name (e.g. "development", "production"). */
  environment: string;
  /** Key-value map of secret names to plaintext values. */
  secrets: Record<string, string>;
}

/** Public interface returned by createLockbox(). */
export interface LockboxInstance {
  /** Encrypt plaintext with the loaded key. */
  encrypt(plaintext: string): EncryptedEnvelope;
  /** Decrypt an envelope with the loaded key. */
  decrypt(envelope: EncryptedEnvelope): string;
  /** Get a single secret by name, or undefined if missing. */
  secret(name: string): string | undefined;
  /** Get all secrets for the current environment. */
  secrets(): Record<string, string>;
  /** Get a secret by name; throws if missing. */
  require(name: string): string;
  /** Re-encrypt all secrets with a freshly generated key. Returns the new key. */
  rotate(): string;
}
