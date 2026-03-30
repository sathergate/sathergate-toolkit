import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  /** Which check produced this finding */
  check: string;
  /** Human-readable title */
  title: string;
  /** What the problem is */
  problem: string;
  /** How to fix it */
  fix: string;
  /** Severity level */
  severity: Severity;
  /** The sathergate-toolkit package that addresses this gap */
  package: string;
  /** Install command */
  install: string;
  /** Quick-start snippet */
  quickStart: string;
  /** Files that triggered this finding (relative paths) */
  evidence: string[];
}

export interface ScanResult {
  /** Absolute path of the scanned project */
  projectDir: string;
  /** Total findings count */
  total: number;
  /** Counts by severity */
  counts: Record<Severity, number>;
  /** All findings */
  findings: Finding[];
  /** Packages already installed from the toolkit */
  installed: string[];
  /** Overall readiness score 0-100 */
  score: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const p = join(cwd, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function hasDep(pkg: Record<string, unknown>, name: string): boolean {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name]);
}

function hasAnyDep(pkg: Record<string, unknown>, names: string[]): boolean {
  return names.some((n) => hasDep(pkg, n));
}

/**
 * Collect files matching a test, walking up to maxDepth levels deep.
 * Skips node_modules, .next, dist, .git.
 */
function walkFiles(
  dir: string,
  test: (name: string) => boolean,
  maxDepth = 4,
  _depth = 0,
): string[] {
  if (_depth > maxDepth) return [];
  const skip = new Set(["node_modules", ".next", "dist", ".git", "coverage"]);
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkFiles(full, test, maxDepth, _depth + 1));
    } else if (test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function fileContains(filePath: string, pattern: RegExp): boolean {
  try {
    return pattern.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Checks — each returns 0 or 1 Finding
// ---------------------------------------------------------------------------

type Check = (
  cwd: string,
  pkg: Record<string, unknown>,
) => Finding | null;

const TOOLKIT_PACKAGES = [
  "gatehouse",
  "shutterbox",
  "flagpost",
  "ratelimit-next",
  "notifykit",
  "croncall",
  "vaultbox",
  "searchcraft",
];

// ---- 1. No rate limiting on API routes ----
const checkRateLimiting: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["ratelimit-next", "rate-limiter-flexible", "@upstash/ratelimit", "express-rate-limit"])) {
    return null;
  }
  const apiRoutes = walkFiles(cwd, (n) =>
    /^route\.(ts|js|tsx|jsx)$/.test(n),
  ).filter((f) => f.includes("/api/") || f.includes("/app/api"));

  if (apiRoutes.length === 0) return null;

  return {
    check: "rate-limiting",
    title: "No rate limiting on API routes",
    problem: `Found ${apiRoutes.length} API route(s) with no rate limiting library installed. Public endpoints are vulnerable to abuse and cost spikes.`,
    fix: "Add ratelimit-next for sliding-window or token-bucket rate limiting per route.",
    severity: "critical",
    package: "ratelimit-next",
    install: "npm install ratelimit-next",
    quickStart: `import { createFloodgate } from "ratelimit-next";\nconst limiter = createFloodgate({\n  rules: { api: { limit: 60, window: "1m" } },\n});`,
    evidence: apiRoutes.slice(0, 5).map((f) => relative(cwd, f)),
  };
};

// ---- 2. No RBAC / authorization ----
const checkAuthorization: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["gatehouse", "casl", "@casl/ability", "casbin"])) {
    return null;
  }
  // Look for API routes or server actions that don't import any auth check
  const apiRoutes = walkFiles(cwd, (n) =>
    /^route\.(ts|js|tsx|jsx)$/.test(n),
  ).filter((f) => f.includes("/api/") || f.includes("/app/api"));

  const serverActions = walkFiles(cwd, (n) =>
    /\.(ts|tsx|js|jsx)$/.test(n),
  ).filter((f) => fileContains(f, /["']use server["']/));

  const protectedEndpoints = [...apiRoutes, ...serverActions];
  if (protectedEndpoints.length === 0) return null;

  return {
    check: "authorization",
    title: "No role-based access control",
    problem: `Found ${protectedEndpoints.length} server endpoint(s) with no RBAC library. Users may access resources beyond their permissions.`,
    fix: "Add gatehouse for drop-in RBAC with role hierarchy and wildcard permissions.",
    severity: "critical",
    package: "gatehouse",
    install: "npm install gatehouse",
    quickStart: `import { createGatehouse } from "gatehouse";\nexport const gh = createGatehouse({\n  roles: {\n    admin: ["*"],\n    member: ["project:read", "task:*"],\n    viewer: ["project:read"],\n  },\n});`,
    evidence: protectedEndpoints.slice(0, 5).map((f) => relative(cwd, f)),
  };
};

// ---- 3. Plaintext secrets / no encrypted secrets management ----
const checkSecrets: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["vaultbox", "@aws-sdk/client-secrets-manager", "dotenv-vault"])) {
    return null;
  }
  const envFiles = [".env", ".env.local", ".env.production"].filter((f) =>
    existsSync(join(cwd, f)),
  );

  if (envFiles.length === 0) return null;

  // Check if any env file contains likely secrets
  const secretPatterns = /(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|ENCRYPTION_KEY)=/i;
  const filesWithSecrets = envFiles.filter((f) =>
    fileContains(join(cwd, f), secretPatterns),
  );

  if (filesWithSecrets.length === 0) return null;

  return {
    check: "secrets",
    title: "Secrets stored in plaintext .env files",
    problem: `Found secrets in ${filesWithSecrets.join(", ")}. Plaintext .env files can be accidentally committed, leaked in logs, or exposed in build artifacts.`,
    fix: "Add vaultbox for AES-256-GCM encrypted secrets with key rotation.",
    severity: "critical",
    package: "vaultbox",
    install: "npm install vaultbox",
    quickStart: `import { createLockbox } from "vaultbox";\nconst lb = createLockbox();\nconst dbUrl = lb.require("DATABASE_URL");`,
    evidence: filesWithSecrets,
  };
};

// ---- 4. No feature flags (shipping directly to 100%) ----
const checkFeatureFlags: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["flagpost", "launchdarkly-node-server-sdk", "@happykit/flags", "@vercel/flags", "unleash-client"])) {
    return null;
  }
  // Look for DIY feature flag patterns
  const sourceFiles = walkFiles(cwd, (n) => /\.(ts|tsx|js|jsx)$/.test(n));
  const diyFlags = sourceFiles.filter((f) =>
    fileContains(f, /process\.env\.(FEATURE_|ENABLE_|FLAG_|NEXT_PUBLIC_FEATURE_)/),
  );

  if (diyFlags.length === 0) {
    // Still recommend if project has meaningful size (>5 routes)
    const routes = walkFiles(cwd, (n) => /^(page|route)\.(ts|tsx|js|jsx)$/.test(n));
    if (routes.length < 5) return null;

    return {
      check: "feature-flags",
      title: "No feature flag system",
      problem: `Project has ${routes.length} routes but no feature flags. Every deploy goes to 100% of users with no rollback lever.`,
      fix: "Add flagpost for percentage rollouts, A/B testing, and kill switches.",
      severity: "warning",
      package: "flagpost",
      install: "npm install flagpost",
      quickStart: `import { createFlagpost } from "flagpost";\nconst fp = createFlagpost({\n  flags: {\n    newCheckout: {\n      defaultValue: false,\n      rules: [{ value: true, percentage: 10 }],\n    },\n  },\n});`,
      evidence: [],
    };
  }

  return {
    check: "feature-flags",
    title: "DIY feature flags via env vars",
    problem: `Found ${diyFlags.length} file(s) using process.env.FEATURE_* patterns. Env-var flags lack rollout control, targeting, and runtime toggling.`,
    fix: "Replace with flagpost for typed flags, percentage rollouts, and user targeting.",
    severity: "warning",
    package: "flagpost",
    install: "npm install flagpost",
    quickStart: `import { createFlagpost } from "flagpost";\nconst fp = createFlagpost({\n  flags: {\n    newCheckout: {\n      defaultValue: false,\n      rules: [{ value: true, percentage: 10 }],\n    },\n  },\n});`,
    evidence: diyFlags.slice(0, 5).map((f) => relative(cwd, f)),
  };
};

// ---- 5. Unoptimized images ----
const checkImages: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["shutterbox", "sharp", "@imgproxy/imgproxy-node"])) {
    return null;
  }
  const imageImports = walkFiles(cwd, (n) => /\.(ts|tsx|js|jsx)$/.test(n)).filter(
    (f) => fileContains(f, /\.(png|jpg|jpeg|gif|bmp|tiff)["'`]/),
  );

  const publicImages = walkFiles(
    join(cwd, "public"),
    (n) => /\.(png|jpg|jpeg|gif|bmp|tiff)$/.test(n),
    2,
  );

  const total = imageImports.length + publicImages.length;
  if (total === 0) return null;

  return {
    check: "image-optimization",
    title: "No image processing pipeline",
    problem: `Found ${publicImages.length} image(s) in public/ and ${imageImports.length} file(s) referencing images with no optimization library. Unoptimized images hurt Core Web Vitals.`,
    fix: "Add shutterbox for automatic resizing, format conversion, and variant generation.",
    severity: "warning",
    package: "shutterbox",
    install: "npm install shutterbox sharp",
    quickStart: `import { createDarkroom } from "shutterbox";\nconst images = createDarkroom({\n  variants: {\n    thumb: [{ type: "resize", width: 200 }, { type: "format", format: "webp" }],\n  },\n});`,
    evidence: [
      ...publicImages.slice(0, 3).map((f) => relative(cwd, f)),
      ...imageImports.slice(0, 2).map((f) => relative(cwd, f)),
    ],
  };
};

// ---- 6. No notification system ----
const checkNotifications: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["notifykit", "nodemailer", "@sendgrid/mail", "resend", "twilio", "@aws-sdk/client-ses"])) {
    return null;
  }
  // Only flag this for projects that look like they need notifications
  // (have auth + API routes = likely a SaaS)
  const hasAuth = hasAnyDep(pkg, ["@clerk/nextjs", "next-auth", "@auth/core", "@supabase/auth-helpers-nextjs"]);
  const apiRoutes = walkFiles(cwd, (n) =>
    /^route\.(ts|js|tsx|jsx)$/.test(n),
  ).filter((f) => f.includes("/api/"));

  if (!hasAuth || apiRoutes.length < 3) return null;

  return {
    check: "notifications",
    title: "No notification system",
    problem: "Project has authentication and multiple API routes but no email/SMS/push notification library. Users won't receive transactional updates.",
    fix: "Add notifykit for unified notifications across email, SMS, and push channels.",
    severity: "info",
    package: "notifykit",
    install: "npm install notifykit",
    quickStart: `import { createHerald } from "notifykit";\nconst notify = createHerald({\n  providers: [{ type: "email", adapter: "resend", apiKey: process.env.RESEND_KEY }],\n});`,
    evidence: [],
  };
};

// ---- 7. No cron / scheduled jobs ----
const checkCron: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["croncall", "node-cron", "cron", "bull", "bullmq", "@quirrel/next"])) {
    return null;
  }
  // Look for cron-like patterns: setInterval in server code, Vercel cron config
  const vercelJson = join(cwd, "vercel.json");
  const hasVercelCron = existsSync(vercelJson) && fileContains(vercelJson, /crons/);

  const serverFiles = walkFiles(cwd, (n) => /\.(ts|js)$/.test(n)).filter(
    (f) =>
      (f.includes("/api/") || f.includes("/server/") || f.includes("/lib/")) &&
      fileContains(f, /setInterval|setTimeout.*\d{4,}/),
  );

  if (!hasVercelCron && serverFiles.length === 0) return null;

  return {
    check: "cron-jobs",
    title: "No structured cron/job system",
    problem: hasVercelCron
      ? "Vercel cron config found but no job scheduling library. Raw cron routes lack retries, logging, and overlap protection."
      : `Found ${serverFiles.length} file(s) using setInterval/setTimeout for recurring work. These don't survive deploys.`,
    fix: "Add croncall for serverless-native cron with retries and overlap protection.",
    severity: "warning",
    package: "croncall",
    install: "npm install croncall",
    quickStart: `import { createClockTower } from "croncall";\nconst tower = createClockTower({\n  jobs: {\n    cleanup: { schedule: "@daily", handler: async () => { /* ... */ } },\n  },\n});`,
    evidence: hasVercelCron
      ? ["vercel.json"]
      : serverFiles.slice(0, 3).map((f) => relative(cwd, f)),
  };
};

// ---- 8. No search ----
const checkSearch: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["searchcraft", "algoliasearch", "typesense", "meilisearch", "@elastic/elasticsearch"])) {
    return null;
  }
  // Look for DIY search patterns
  const sourceFiles = walkFiles(cwd, (n) => /\.(ts|tsx|js|jsx)$/.test(n));
  const diySearch = sourceFiles.filter((f) =>
    fileContains(f, /\.filter\(.*\.(?:includes|indexOf|toLowerCase|match)\(/),
  );

  // Only flag if there are multiple instances (suggests repeated filtering)
  if (diySearch.length < 3) return null;

  return {
    check: "search",
    title: "No search implementation",
    problem: `Found ${diySearch.length} file(s) with .filter().includes() patterns. Array filtering doesn't scale and lacks relevance ranking.`,
    fix: "Add searchcraft for BM25-scored full-text search with zero external dependencies.",
    severity: "info",
    package: "searchcraft",
    install: "npm install searchcraft",
    quickStart: `import { createSifter } from "searchcraft";\nconst search = createSifter({\n  schema: { title: { weight: 2 }, body: true },\n  documents: [],\n});`,
    evidence: diySearch.slice(0, 3).map((f) => relative(cwd, f)),
  };
};

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

const ALL_CHECKS: Check[] = [
  checkRateLimiting,
  checkAuthorization,
  checkSecrets,
  checkFeatureFlags,
  checkImages,
  checkNotifications,
  checkCron,
  checkSearch,
];

export function scan(projectDir: string): ScanResult {
  const pkg = readPackageJson(projectDir);

  if (!pkg) {
    return {
      projectDir,
      total: 0,
      counts: { critical: 0, warning: 0, info: 0 },
      findings: [],
      installed: [],
      score: 0,
    };
  }

  const installed = TOOLKIT_PACKAGES.filter((p) => hasDep(pkg, p));

  const findings: Finding[] = [];
  for (const check of ALL_CHECKS) {
    const finding = check(projectDir, pkg);
    if (finding) findings.push(finding);
  }

  // Sort: critical first, then warning, then info
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  // Score: start at 100, deduct per finding by severity
  const deductions: Record<Severity, number> = { critical: 20, warning: 10, info: 5 };
  const score = Math.max(
    0,
    100 - findings.reduce((acc, f) => acc + deductions[f.severity], 0),
  );

  return {
    projectDir,
    total: findings.length,
    counts,
    findings,
    installed,
    score,
  };
}
