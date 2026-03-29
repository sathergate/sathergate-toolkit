#!/usr/bin/env node

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { generateKey, encrypt, decrypt } from "./core/crypto.js";
import type { EncryptedEnvelope } from "./core/types.js";

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function positional(index: number): string | undefined {
  // Skip flags and their values, collect positionals after the command
  const positionals: string[] = [];
  let i = 1; // skip command
  while (i < args.length) {
    if (args[i]!.startsWith("--")) {
      i += 2; // skip flag + value
    } else {
      positionals.push(args[i]!);
      i++;
    }
  }
  return positionals[index];
}

const env = flag("env") ?? "development";
const secretsDir = ".secrets";
const keyPath = ".vaultbox-key";

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

interface StoreData {
  secrets: Record<string, EncryptedEnvelope>;
}

function storeFilePath(): string {
  return join(secretsDir, `${env}.json`);
}

function loadStore(): StoreData {
  const fp = storeFilePath();
  if (!existsSync(fp)) return { secrets: {} };
  return JSON.parse(readFileSync(fp, "utf8")) as StoreData;
}

function saveStore(store: StoreData): void {
  if (!existsSync(secretsDir)) mkdirSync(secretsDir, { recursive: true });
  writeFileSync(storeFilePath(), JSON.stringify(store, null, 2) + "\n");
}

function loadKeyOrDie(): string {
  const envKey = process.env["LOCKBOX_KEY"];
  if (envKey) return envKey.trim();
  if (!existsSync(keyPath)) {
    console.error(`Error: No key found. Run "vaultbox init" first.`);
    process.exit(1);
  }
  return readFileSync(keyPath, "utf8").trim();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdInit(): void {
  // Generate key
  if (existsSync(keyPath)) {
    console.log(`Key already exists at ${keyPath}`);
  } else {
    const key = generateKey();
    writeFileSync(keyPath, key + "\n", { mode: 0o600 });
    console.log(`Generated encryption key: ${keyPath}`);
  }

  // Create secrets dir
  if (!existsSync(secretsDir)) {
    mkdirSync(secretsDir, { recursive: true });
    console.log(`Created secrets directory: ${secretsDir}/`);
  }

  // Add .vaultbox-key to .gitignore
  const gitignorePath = ".gitignore";
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    if (!content.includes(".vaultbox-key")) {
      appendFileSync(gitignorePath, "\n.vaultbox-key\n");
      console.log(`Added .vaultbox-key to .gitignore`);
    }
  } else {
    writeFileSync(gitignorePath, ".vaultbox-key\n");
    console.log(`Created .gitignore with .vaultbox-key`);
  }

  // --- Ecosystem detection ---
  const hints: string[] = [];

  // Detect package.json
  const pkgPath = "package.json";
  let pkg: Record<string, unknown> | undefined;
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      console.log(`\nDetected package.json (${(pkg["name"] as string) ?? "unnamed project"})`);
    } catch {
      // Malformed package.json — skip ecosystem detection
    }
  }

  // Detect .env file
  if (existsSync(".env")) {
    hints.push(`Run "vaultbox import .env" to encrypt your existing .env secrets`);
  }

  if (pkg) {
    const allDeps: Record<string, string> = {
      ...((pkg["dependencies"] as Record<string, string>) ?? {}),
      ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
    };

    // Detect Vercel (vercel or @vercel/* packages, or vercel scripts)
    const hasVercel =
      "vercel" in allDeps ||
      Object.keys(allDeps).some((d) => d.startsWith("@vercel/")) ||
      JSON.stringify(pkg["scripts"] ?? {}).includes("vercel");

    if (hasVercel) {
      hints.push(
        `Vercel detected. Add LOCKBOX_KEY as an environment variable in your Vercel project settings:` +
        `\n    vercel env add LOCKBOX_KEY`,
      );
    }

    // Detect dotenv
    if ("dotenv" in allDeps || "dotenv-expand" in allDeps) {
      hints.push(
        `You can replace dotenv with lockbox. ` +
        `lockbox encrypts secrets at rest and loads them the same way.`,
      );
    }
  }

  // --- Success message with next steps ---
  console.log("\n--- lockbox initialized successfully ---\n");
  console.log("Next steps:");
  console.log("  1. lockbox set <NAME> <VALUE>     Store a secret");
  console.log("  2. lockbox env                     Print secrets as .env format");
  console.log("  3. Add `import 'lockbox/auto'` to load secrets at runtime");

  if (hints.length > 0) {
    console.log("\nHints:");
    for (const hint of hints) {
      console.log(`  - ${hint}`);
    }
  }
}

function cmdSet(): void {
  const name = positional(0);
  const value = positional(1);
  if (!name || !value) {
    console.error("Usage: lockbox set <name> <value> [--env <environment>]");
    process.exit(1);
  }

  const key = loadKeyOrDie();
  const store = loadStore();
  store.secrets[name] = encrypt(value, key);
  saveStore(store);
  console.log(`Set "${name}" in ${env}`);
}

function cmdGet(): void {
  const name = positional(0);
  if (!name) {
    console.error("Usage: lockbox get <name> [--env <environment>]");
    process.exit(1);
  }

  const key = loadKeyOrDie();
  const store = loadStore();
  const envelope = store.secrets[name];
  if (!envelope) {
    console.error(`Secret "${name}" not found in ${env}`);
    process.exit(1);
  }

  console.log(decrypt(envelope, key));
}

function cmdList(): void {
  const store = loadStore();
  const names = Object.keys(store.secrets);
  if (names.length === 0) {
    console.log(`No secrets in ${env}`);
    return;
  }
  for (const name of names.sort()) {
    console.log(name);
  }
}

function cmdEnv(): void {
  const key = loadKeyOrDie();
  const store = loadStore();

  for (const [name, envelope] of Object.entries(store.secrets)) {
    const value = decrypt(envelope, key);
    console.log(`${name}=${value}`);
  }
}

function cmdRotate(): void {
  const oldKey = loadKeyOrDie();
  const newKey = generateKey();

  if (!existsSync(secretsDir)) {
    console.log("No secrets directory found. Nothing to rotate.");
    return;
  }

  let files: string[];
  try {
    files = readdirSync(secretsDir).filter((f) => f.endsWith(".json"));
  } catch {
    files = [];
  }

  let total = 0;
  for (const file of files) {
    const filePath = join(secretsDir, file);
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as StoreData;

    const reEncrypted: Record<string, EncryptedEnvelope> = {};
    for (const [name, envelope] of Object.entries(data.secrets)) {
      const plaintext = decrypt(envelope, oldKey);
      reEncrypted[name] = encrypt(plaintext, newKey);
      total++;
    }

    writeFileSync(
      filePath,
      JSON.stringify({ secrets: reEncrypted }, null, 2) + "\n",
    );
  }

  writeFileSync(keyPath, newKey + "\n", { mode: 0o600 });
  console.log(`Rotated ${total} secret(s) across ${files.length} environment(s).`);
  console.log(`New key written to ${keyPath}`);
}

function cmdImport(): void {
  const filePath = positional(0);
  if (!filePath) {
    console.error("Usage: lockbox import <.env-file> [--env <environment>]");
    process.exit(1);
  }

  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const key = loadKeyOrDie();
  const store = loadStore();
  const content = readFileSync(resolved, "utf8");
  let count = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const name = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (name) {
      store.secrets[name] = encrypt(value, key);
      count++;
    }
  }

  saveStore(store);
  console.log(`Imported ${count} secret(s) into ${env}`);
}

function printHelp(): void {
  console.log(`lockbox - Encrypted secrets for Next.js

Usage:
  lockbox init                            Generate key and initialize secrets directory
  lockbox set <name> <value> [--env ENV]  Encrypt and store a secret
  lockbox get <name> [--env ENV]          Decrypt and print a secret
  lockbox list [--env ENV]                List secret names (not values)
  lockbox env [--env ENV]                 Output all secrets as .env format
  lockbox rotate                          Re-encrypt all secrets with a new key
  lockbox import <file> [--env ENV]       Import secrets from a .env file

Options:
  --env ENV    Target environment (default: "development")
  --help       Show this help message`);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

switch (command) {
  case "init":
    cmdInit();
    break;
  case "set":
    cmdSet();
    break;
  case "get":
    cmdGet();
    break;
  case "list":
    cmdList();
    break;
  case "env":
    cmdEnv();
    break;
  case "rotate":
    cmdRotate();
    break;
  case "import":
    cmdImport();
    break;
  case "--help":
  case "-h":
  case "help":
    printHelp();
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}\n`);
    }
    printHelp();
    process.exit(command ? 1 : 0);
}
