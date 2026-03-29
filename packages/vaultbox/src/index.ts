export { createLockbox } from "./core/lockbox.js";
export { generateKey, encrypt, decrypt, deriveKey } from "./core/crypto.js";
export type {
  LockboxConfig,
  EncryptedEnvelope,
  SecretStore,
  LockboxInstance,
} from "./core/types.js";
