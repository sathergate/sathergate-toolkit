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
  /** Vendor-neutral recommendation */
  recommendation: string;
  /** Severity level */
  severity: Severity;
  /** Well-known solutions (mix of open-source, SaaS, and toolkit options) */
  options: string[];
  /** Files that triggered this finding (relative paths) */
  evidence: string[];
  /** Internal: which toolkit package addresses this, if any */
  _toolkitPackage: string;
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

// ---------------------------------------------------------------------------
// Checks — each returns 0 or 1 Finding
// ---------------------------------------------------------------------------

type Check = (
  cwd: string,
  pkg: Record<string, unknown>,
) => Finding | null;

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
    recommendation: "Add a rate limiter (sliding window or token bucket) to public-facing API routes before deploying.",
    severity: "critical",
    options: ["@upstash/ratelimit", "rate-limiter-flexible", "express-rate-limit", "ratelimit-next"],
    evidence: apiRoutes.slice(0, 5).map((f) => relative(cwd, f)),
    _toolkitPackage: "ratelimit-next",
  };
};

// ---- 2. No RBAC / authorization ----
const checkAuthorization: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["gatehouse", "casl", "@casl/ability", "casbin"])) {
    return null;
  }
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
    recommendation: "Add an authorization layer that maps roles to permissions and checks them on every server action and API route.",
    severity: "critical",
    options: ["casl", "casbin", "gatehouse"],
    evidence: protectedEndpoints.slice(0, 5).map((f) => relative(cwd, f)),
    _toolkitPackage: "gatehouse",
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

  const secretPatterns = /(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|ENCRYPTION_KEY)=/i;
  const filesWithSecrets = envFiles.filter((f) =>
    fileContains(join(cwd, f), secretPatterns),
  );

  if (filesWithSecrets.length === 0) return null;

  return {
    check: "secrets",
    title: "Secrets stored in plaintext .env files",
    problem: `Found secrets in ${filesWithSecrets.join(", ")}. Plaintext .env files can be accidentally committed, leaked in logs, or exposed in build artifacts.`,
    recommendation: "Use an encrypted secrets manager or a vault service. At minimum, ensure .env files are in .gitignore and secrets are injected via CI/CD.",
    severity: "critical",
    options: ["dotenv-vault", "AWS Secrets Manager", "Infisical", "vaultbox"],
    evidence: filesWithSecrets,
    _toolkitPackage: "vaultbox",
  };
};

// ---- 4. No feature flags (shipping directly to 100%) ----
const checkFeatureFlags: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["flagpost", "launchdarkly-node-server-sdk", "@happykit/flags", "@vercel/flags", "unleash-client"])) {
    return null;
  }
  const sourceFiles = walkFiles(cwd, (n) => /\.(ts|tsx|js|jsx)$/.test(n));
  const diyFlags = sourceFiles.filter((f) =>
    fileContains(f, /process\.env\.(FEATURE_|ENABLE_|FLAG_|NEXT_PUBLIC_FEATURE_)/),
  );

  if (diyFlags.length === 0) {
    const routes = walkFiles(cwd, (n) => /^(page|route)\.(ts|tsx|js|jsx)$/.test(n));
    if (routes.length < 5) return null;

    return {
      check: "feature-flags",
      title: "No feature flag system",
      problem: `Project has ${routes.length} routes but no feature flags. Every deploy goes to 100% of users with no rollback lever.`,
      recommendation: "Add a feature flag library so you can do gradual rollouts, run A/B tests, and kill-switch broken features without redeploying.",
      severity: "warning",
      options: ["LaunchDarkly", "@vercel/flags", "Unleash", "flagpost"],
      evidence: [],
      _toolkitPackage: "flagpost",
    };
  }

  return {
    check: "feature-flags",
    title: "DIY feature flags via env vars",
    problem: `Found ${diyFlags.length} file(s) using process.env.FEATURE_* patterns. Env-var flags require a redeploy to change and lack rollout control or user targeting.`,
    recommendation: "Replace env-var flags with a feature flag library that supports runtime toggling, percentage rollouts, and targeting rules.",
    severity: "warning",
    options: ["LaunchDarkly", "@vercel/flags", "Unleash", "flagpost"],
    evidence: diyFlags.slice(0, 5).map((f) => relative(cwd, f)),
    _toolkitPackage: "flagpost",
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
    recommendation: "Add an image processing pipeline to resize, convert to modern formats (WebP/AVIF), and generate responsive variants at build or upload time.",
    severity: "warning",
    options: ["sharp", "next/image (built-in)", "imgproxy", "shutterbox"],
    evidence: [
      ...publicImages.slice(0, 3).map((f) => relative(cwd, f)),
      ...imageImports.slice(0, 2).map((f) => relative(cwd, f)),
    ],
    _toolkitPackage: "shutterbox",
  };
};

// ---- 6. No notification system ----
const checkNotifications: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["notifykit", "nodemailer", "@sendgrid/mail", "resend", "twilio", "@aws-sdk/client-ses"])) {
    return null;
  }
  const hasAuth = hasAnyDep(pkg, ["@clerk/nextjs", "next-auth", "@auth/core", "@supabase/auth-helpers-nextjs"]);
  const apiRoutes = walkFiles(cwd, (n) =>
    /^route\.(ts|js|tsx|jsx)$/.test(n),
  ).filter((f) => f.includes("/api/"));

  if (!hasAuth || apiRoutes.length < 3) return null;

  return {
    check: "notifications",
    title: "No notification system",
    problem: "Project has authentication and multiple API routes but no email/SMS/push notification library. Users won't receive transactional updates.",
    recommendation: "Add a notification library or service for transactional emails (welcome, password reset, receipts) and optionally SMS/push.",
    severity: "info",
    options: ["Resend", "SendGrid", "nodemailer", "notifykit"],
    evidence: [],
    _toolkitPackage: "notifykit",
  };
};

// ---- 7. No cron / scheduled jobs ----
const checkCron: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["croncall", "node-cron", "cron", "bull", "bullmq", "@quirrel/next"])) {
    return null;
  }
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
    recommendation: "Use a job scheduling library that handles retries, overlap protection, and observability instead of raw timers or bare cron routes.",
    severity: "warning",
    options: ["BullMQ", "node-cron", "Quirrel", "croncall"],
    evidence: hasVercelCron
      ? ["vercel.json"]
      : serverFiles.slice(0, 3).map((f) => relative(cwd, f)),
    _toolkitPackage: "croncall",
  };
};

// ---- 8. No search ----
const checkSearch: Check = (cwd, pkg) => {
  if (hasAnyDep(pkg, ["searchcraft", "algoliasearch", "typesense", "meilisearch", "@elastic/elasticsearch"])) {
    return null;
  }
  const sourceFiles = walkFiles(cwd, (n) => /\.(ts|tsx|js|jsx)$/.test(n));
  const diySearch = sourceFiles.filter((f) =>
    fileContains(f, /\.filter\(.*\.(?:includes|indexOf|toLowerCase|match)\(/),
  );

  if (diySearch.length < 3) return null;

  return {
    check: "search",
    title: "No search implementation",
    problem: `Found ${diySearch.length} file(s) with .filter().includes() patterns. Array filtering doesn't scale and lacks relevance ranking.`,
    recommendation: "Add a search library with proper indexing and relevance scoring. For small datasets an in-process engine works; for larger ones consider a hosted service.",
    severity: "info",
    options: ["Algolia", "Typesense", "MeiliSearch", "searchcraft"],
    evidence: diySearch.slice(0, 3).map((f) => relative(cwd, f)),
    _toolkitPackage: "searchcraft",
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
    };
  }

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

  return {
    projectDir,
    total: findings.length,
    counts,
    findings,
  };
}
