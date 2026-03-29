import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { generateKey, encrypt, decrypt } from "./core/crypto.js";
import type { EncryptedEnvelope } from "./core/types.js";

// ---------------------------------------------------------------------------
// Store helpers (shared with cli.ts)
// ---------------------------------------------------------------------------

interface StoreData {
  secrets: Record<string, EncryptedEnvelope>;
}

function storeFilePath(secretsDir: string, env: string): string {
  return join(secretsDir, `${env}.json`);
}

function loadStore(secretsDir: string, env: string): StoreData {
  const fp = storeFilePath(secretsDir, env);
  if (!existsSync(fp)) return { secrets: {} };
  return JSON.parse(readFileSync(fp, "utf8")) as StoreData;
}

function saveStore(
  secretsDir: string,
  env: string,
  store: StoreData,
): void {
  if (!existsSync(secretsDir)) mkdirSync(secretsDir, { recursive: true });
  writeFileSync(
    storeFilePath(secretsDir, env),
    JSON.stringify(store, null, 2) + "\n",
  );
}

function loadKey(projectDir: string): string {
  const keyPath = join(projectDir, ".vaultbox-key");
  const envKey = process.env["LOCKBOX_KEY"];
  if (envKey) return envKey.trim();
  if (!existsSync(keyPath)) {
    throw new Error(
      `No key found. Run "lockbox_init" first or set LOCKBOX_KEY env var.`,
    );
  }
  return readFileSync(keyPath, "utf8").trim();
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export const server = new McpServer({
  name: "lockbox",
  version: "0.1.0",
});

// --- lockbox_init -----------------------------------------------------------

server.tool(
  "lockbox_init",
  "Initialize lockbox in a project. Creates .vaultbox-key, .secrets/ directory, and updates .gitignore.",
  {
    projectDir: z.string().describe("Absolute path to the project directory"),
  },
  async ({ projectDir }) => {
    const keyPath = join(projectDir, ".vaultbox-key");
    const secretsDir = join(projectDir, ".secrets");
    const gitignorePath = join(projectDir, ".gitignore");
    const messages: string[] = [];

    // Generate key
    if (existsSync(keyPath)) {
      messages.push(`Key already exists at ${keyPath}`);
    } else {
      const key = generateKey();
      writeFileSync(keyPath, key + "\n", { mode: 0o600 });
      messages.push(`Generated encryption key: ${keyPath}`);
    }

    // Create secrets dir
    if (!existsSync(secretsDir)) {
      mkdirSync(secretsDir, { recursive: true });
      messages.push(`Created secrets directory: ${secretsDir}/`);
    } else {
      messages.push(`Secrets directory already exists: ${secretsDir}/`);
    }

    // Add .vaultbox-key to .gitignore
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, "utf8");
      if (!content.includes(".vaultbox-key")) {
        appendFileSync(gitignorePath, "\n.vaultbox-key\n");
        messages.push(`Added .vaultbox-key to .gitignore`);
      } else {
        messages.push(`.vaultbox-key already in .gitignore`);
      }
    } else {
      writeFileSync(gitignorePath, ".vaultbox-key\n");
      messages.push(`Created .gitignore with .vaultbox-key`);
    }

    messages.push("");
    messages.push("Next steps:");
    messages.push('  1. Use lockbox_set to store a secret');
    messages.push('  2. Use lockbox_list to see stored secrets');
    messages.push("  3. Add `import 'lockbox/auto'` to load secrets at runtime");

    return {
      content: [{ type: "text", text: messages.join("\n") }],
    };
  },
);

// --- lockbox_set ------------------------------------------------------------

server.tool(
  "lockbox_set",
  "Set (encrypt and store) a secret in the lockbox.",
  {
    name: z.string().describe("Secret name (e.g. DATABASE_URL)"),
    value: z.string().describe("Secret value to encrypt"),
    env: z
      .string()
      .optional()
      .describe('Target environment (default: "development")'),
  },
  async ({ name, value, env }) => {
    const environment = env ?? "development";

    // Discover projectDir from the store location — we look for .vaultbox-key
    // walking up from cwd. For MCP we require the key to already exist.
    const projectDir = process.cwd();
    const key = loadKey(projectDir);
    const secretsDir = join(projectDir, ".secrets");

    const store = loadStore(secretsDir, environment);
    store.secrets[name] = encrypt(value, key);
    saveStore(secretsDir, environment, store);

    return {
      content: [
        {
          type: "text",
          text: `Set "${name}" in ${environment} environment.`,
        },
      ],
    };
  },
);

// --- lockbox_list -----------------------------------------------------------

server.tool(
  "lockbox_list",
  "List secret names (not values) stored in the lockbox.",
  {
    env: z
      .string()
      .optional()
      .describe('Target environment (default: "development")'),
  },
  async ({ env }) => {
    const environment = env ?? "development";
    const projectDir = process.cwd();
    const secretsDir = join(projectDir, ".secrets");
    const store = loadStore(secretsDir, environment);
    const names = Object.keys(store.secrets).sort();

    if (names.length === 0) {
      return {
        content: [
          { type: "text", text: `No secrets in ${environment} environment.` },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Secrets in ${environment} (${names.length}):\n${names.map((n) => `  - ${n}`).join("\n")}`,
        },
      ],
    };
  },
);

// --- lockbox_get ------------------------------------------------------------

server.tool(
  "lockbox_get",
  "Get (decrypt) a secret from the lockbox.",
  {
    name: z.string().describe("Secret name to retrieve"),
    env: z
      .string()
      .optional()
      .describe('Target environment (default: "development")'),
  },
  async ({ name, env }) => {
    const environment = env ?? "development";
    const projectDir = process.cwd();
    const key = loadKey(projectDir);
    const secretsDir = join(projectDir, ".secrets");
    const store = loadStore(secretsDir, environment);
    const envelope = store.secrets[name];

    if (!envelope) {
      return {
        content: [
          {
            type: "text",
            text: `Secret "${name}" not found in ${environment} environment.`,
          },
        ],
        isError: true,
      };
    }

    const decrypted = decrypt(envelope, key);

    return {
      content: [{ type: "text", text: decrypted }],
    };
  },
);
