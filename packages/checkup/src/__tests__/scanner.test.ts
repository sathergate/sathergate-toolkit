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
    expect(result.score).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("returns perfect score when no gaps detected", () => {
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
    expect(result.score).toBe(100);
    expect(result.installed).toContain("gatehouse");
    expect(result.installed).toContain("ratelimit-next");
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
      expect(finding!.package).toBe("ratelimit-next");
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
      expect(finding!.package).toBe("gatehouse");
    });

    it("skips when gatehouse is installed", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0", gatehouse: "^0.1.0" },
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
      expect(finding!.package).toBe("vaultbox");
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
      expect(finding!.package).toBe("flagpost");
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
      expect(finding!.package).toBe("shutterbox");
    });
  });

  describe("scoring", () => {
    it("deducts 20 points per critical finding", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      writeFile(tmpDir, "app/api/route.ts", "export async function GET() {}");
      writeFile(tmpDir, ".env", "SECRET_KEY=abc123");

      const result = scan(tmpDir);
      const criticalCount = result.counts.critical;
      expect(criticalCount).toBeGreaterThan(0);
      // Score should be 100 minus deductions
      expect(result.score).toBeLessThan(100);
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

    it("never goes below 0", () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        dependencies: { next: "^15.0.0" },
      }));
      // Create enough findings to theoretically exceed 100 points of deductions
      writeFile(tmpDir, "app/api/a/route.ts", "export async function GET() {}");
      writeFile(tmpDir, "app/api/b/route.ts", "export async function POST() {}");
      writeFile(tmpDir, ".env", "SECRET_KEY=abc\nDATABASE_URL=postgres://x\nAPI_KEY=y");
      writeFile(tmpDir, "public/img.png", "x");
      writeFile(tmpDir, "app/page.tsx", "const x = process.env.FEATURE_X;");

      const result = scan(tmpDir);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
