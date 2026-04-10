import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scan } from "../core/scanner.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function createTmpDir(): string {
  const dir = join(tmpdir(), `checkup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(base: string, path: string, content: string): void {
  const full = join(base, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf-8");
}

describe("scan", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty results for non-project directory", () => {
    const result = scan(tmpDir);
    expect(result.total).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("returns no findings when all gaps are covered", () => {
    writeFile(tmpDir, "package.json", JSON.stringify({
      dependencies: {
        next: "^15.0.0",
        gatehouse: "^0.1.0",
        "ratelimit-next": "^0.1.0",
        vaultbox: "^0.1.0",
        flagpost: "^0.1.0",
        shutterbox: "^0.1.0",
        notifykit: "^0.1.0",
        croncall: "^0.1.0",
        searchcraft: "^0.1.0",
      },
    }));
    const result = scan(tmpDir);
    expect(result.total).toBe(0);
  });

  describe("rate limiting check", () => {
    it("flags API routes with no rate limiter", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/users/route.ts", "export async function GET() { return Response.json([]); }");
      writeFile(tmpDir, "app/api/posts/route.ts", "export async function POST() { return Response.json({}); }");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "rate-limiting");
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("critical");
      expect(finding!.options.length).toBeGreaterThan(1);
      expect(finding!.evidence.length).toBeGreaterThan(0);
    });

    it("skips when ratelimit-next is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", "ratelimit-next": "^0.1.0" },
      }));
      writeFile(tmpDir, "app/api/users/route.ts", "export async function GET() {}");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "rate-limiting");
      expect(finding).toBeUndefined();
    });

    it("skips when a third-party rate limiter is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", "@upstash/ratelimit": "^1.0.0" },
      }));
      writeFile(tmpDir, "app/api/users/route.ts", "export async function GET() {}");

      const result = scan(tmpDir);
      expect(result.findings.find((f) => f.check === "rate-limiting")).toBeUndefined();
    });
  });

  describe("authorization check", () => {
    it("flags server endpoints with no RBAC", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/admin/route.ts", "export async function DELETE() {}");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "authorization");
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("critical");
    });

    it("skips when gatehouse is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", gatehouse: "^0.1.0" },
      }));
      writeFile(tmpDir, "app/api/admin/route.ts", "export async function DELETE() {}");

      const result = scan(tmpDir);
      expect(result.findings.find((f) => f.check === "authorization")).toBeUndefined();
    });

    it("skips when casl is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", casl: "^6.0.0" },
      }));
      writeFile(tmpDir, "app/api/admin/route.ts", "export async function DELETE() {}");

      const result = scan(tmpDir);
      expect(result.findings.find((f) => f.check === "authorization")).toBeUndefined();
    });
  });

  describe("secrets check", () => {
    it("flags plaintext secrets in .env", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, ".env", "DATABASE_URL=postgres://user:pass@localhost/db\nAPI_KEY=sk_live_abc123");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "secrets");
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("critical");
    });

    it("skips when vaultbox is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", vaultbox: "^0.1.0" },
      }));
      writeFile(tmpDir, ".env", "DATABASE_URL=postgres://localhost/db");

      const result = scan(tmpDir);
      expect(result.findings.find((f) => f.check === "secrets")).toBeUndefined();
    });
  });

  describe("feature flags check", () => {
    it("flags DIY feature flags via env vars", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/page.tsx", "const isNew = process.env.FEATURE_NEW_UI === 'true';");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "feature-flags");
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("warning");
    });
  });

  describe("image optimization check", () => {
    it("flags unoptimized images in public/", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "public/hero.png", "fake-png-content");
      writeFile(tmpDir, "public/logo.jpg", "fake-jpg-content");

      const result = scan(tmpDir);
      const finding = result.findings.find((f) => f.check === "image-optimization");
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("warning");
    });
  });

  describe("findings are vendor-neutral", () => {
    it("lists multiple options including non-toolkit solutions", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/route.ts", "export async function GET() {}");

      const result = scan(tmpDir);
      for (const finding of result.findings) {
        // Every finding should list more than just the toolkit package
        expect(finding.options.length).toBeGreaterThanOrEqual(2);
        // The recommendation should not mention sathergate or toolkit
        expect(finding.recommendation).not.toMatch(/sathergate/i);
      }
    });
  });

  describe("severity counts", () => {
    it("tracks critical findings in counts", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/route.ts", "export async function GET() {}");
      writeFile(tmpDir, ".env", "SECRET_KEY=abc123");

      const result = scan(tmpDir);
      expect(result.counts.critical).toBeGreaterThan(0);
    });

    it("sorts findings by severity (critical first)", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/route.ts", "export async function GET() {}");
      writeFile(tmpDir, ".env", "SECRET_KEY=abc123");
      writeFile(tmpDir, "app/page.tsx", "const x = process.env.FEATURE_X;");

      const result = scan(tmpDir);
      if (result.findings.length >= 2) {
        const severities = result.findings.map((f) => f.severity);
        const criticalIdx = severities.indexOf("critical");
        const warningIdx = severities.indexOf("warning");
        if (criticalIdx !== -1 && warningIdx !== -1) {
          expect(criticalIdx).toBeLessThan(warningIdx);
        }
      }
    });
  });
});
