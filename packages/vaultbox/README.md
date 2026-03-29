# vaultbox

Encrypted secrets for Next.js. No vault needed.

Store encrypted secrets in your repo. Decrypt them at runtime with a single key. Zero external dependencies beyond Node.js built-in `crypto`.

## Install

```bash
npm install vaultbox
```

## Quick Start

```bash
# 1. Initialize lockbox in your project
npx lockbox init

# 2. Store secrets
npx lockbox set DATABASE_URL "postgresql://user:pass@host/db"
npx lockbox set API_KEY "sk-secret-key" --env production

# 3. Use in your code
```

```typescript
import { createLockbox } from "vaultbox";

const box = createLockbox();

// Get a secret (returns undefined if missing)
const dbUrl = box.secret("DATABASE_URL");

// Get a secret (throws if missing)
const apiKey = box.require("API_KEY");

// Get all secrets for the current NODE_ENV
const all = box.secrets();
```

## CLI Reference

### `lockbox init`

Generates a `.lockbox-key` file (random 256-bit key), creates the `.secrets/` directory, and adds `.lockbox-key` to `.gitignore`.

### `lockbox set <name> <value> [--env ENV]`

Encrypts a secret and stores it in `.secrets/{env}.json`. Default environment: `development`.

```bash
lockbox set STRIPE_KEY sk_live_abc123
lockbox set STRIPE_KEY sk_test_xyz789 --env production
```

### `lockbox get <name> [--env ENV]`

Decrypts and prints a single secret.

```bash
lockbox get STRIPE_KEY
lockbox get STRIPE_KEY --env production
```

### `lockbox list [--env ENV]`

Lists stored secret names (values are not shown).

```bash
lockbox list
lockbox list --env production
```

### `lockbox env [--env ENV]`

Outputs all secrets in `.env` format. Useful for piping:

```bash
lockbox env --env production > .env.local
```

### `lockbox rotate`

Generates a new encryption key and re-encrypts all secrets across all environments.

```bash
lockbox rotate
```

### `lockbox import <file> [--env ENV]`

Imports secrets from an existing `.env` file.

```bash
lockbox import .env
lockbox import .env.production --env production
```

## Programmatic API

### `createLockbox(config?)`

Creates a lockbox instance that reads secrets for the current `NODE_ENV`.

```typescript
import { createLockbox } from "vaultbox";

const box = createLockbox();
// Or with custom paths:
const box = createLockbox({
  keyPath: ".lockbox-key",   // default
  secretsDir: ".secrets",    // default
});
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `secret(name)` | `string \| undefined` | Get a decrypted secret |
| `require(name)` | `string` | Get a secret; throws if missing |
| `secrets()` | `Record<string, string>` | All secrets for current env |
| `encrypt(plaintext)` | `EncryptedEnvelope` | Encrypt arbitrary text |
| `decrypt(envelope)` | `string` | Decrypt an envelope |
| `rotate()` | `string` | Re-encrypt everything; returns new key |

### `generateKey()`

Generate a random 256-bit encryption key as a hex string.

```typescript
import { generateKey } from "vaultbox";
const key = generateKey(); // 64-char hex string
```

## How It Works

1. `lockbox init` generates a random 256-bit master key and writes it to `.lockbox-key`
2. When you `set` a secret, lockbox:
   - Generates a random 128-bit IV and 256-bit salt
   - Derives an encryption key from the master key + salt using PBKDF2-SHA512 (100,000 iterations)
   - Encrypts the value with AES-256-GCM
   - Stores the envelope (IV, salt, ciphertext, auth tag) in `.secrets/{env}.json`
3. When you read a secret at runtime, lockbox reverses the process using the same master key
4. Each secret gets its own random IV and salt, so identical values produce different ciphertexts

## Git Workflow

**Commit these files** (encrypted, safe to share):
- `.secrets/development.json`
- `.secrets/production.json`

**Never commit** (added to `.gitignore` by `lockbox init`):
- `.lockbox-key`

Share the key with your team via a secure channel (1Password, Slack DM, etc). In CI/CD, set the `LOCKBOX_KEY` environment variable.

```bash
# CI/CD example
LOCKBOX_KEY=your-hex-key-here npm run build
```

## Key Rotation

```bash
lockbox rotate
```

This generates a new key, re-encrypts every secret in every environment, and writes the new key to `.lockbox-key`. Distribute the new key to your team and update CI/CD.

## Migration from .env

```bash
# Import your existing .env file
lockbox import .env

# Import production secrets
lockbox import .env.production --env production

# Verify
lockbox list
lockbox list --env production

# Remove the old .env files
rm .env .env.production
```

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
