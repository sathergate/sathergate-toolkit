export { createLockbox } from "./lockbox.js";
export {
  generateKey,
  encrypt,
  decrypt,
  deriveKey,
} from "./crypto.js";
export type {
  LockboxConfig,
  EncryptedEnvelope,
  SecretStore,
  LockboxInstance,
} from "./types.js";
