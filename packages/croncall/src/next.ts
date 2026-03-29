import type { ClockTower, JobRegistry, JobResult } from "./core/types.js";

/** Options for the cron route handler */
export interface CronHandlerOptions {
  /**
   * Secret to validate against the Authorization header.
   * Falls back to the ClockTower config secret, then CRON_SECRET env var.
   */
  secret?: string;
}

interface NextRequest {
  headers: { get(name: string): string | null };
  url: string;
  nextUrl?: { searchParams: { get(name: string): string | null } };
}

/**
 * Create a Next.js Route Handler (GET) for running scheduled jobs.
 *
 * Vercel Cron sends a GET request with an `Authorization: Bearer <secret>` header.
 * This handler validates the secret, then runs due jobs (or a specific job via `?job=name`).
 *
 * @example
 * ```ts
 * // app/api/cron/route.ts
 * import { createCronHandler } from "croncall/next";
 * import { tower } from "@/lib/jobs";
 *
 * export const GET = createCronHandler(tower);
 * ```
 */
export function createCronHandler<T extends JobRegistry>(
  clocktower: ClockTower<T>,
  options?: CronHandlerOptions,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    // Resolve secret: option > config > env
    const secret =
      options?.secret ??
      clocktower.config.secret ??
      process.env.CRON_SECRET;

    // Validate authorization if a secret is configured
    if (secret) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      if (token !== secret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Check for a specific job name via query param
    let jobName: string | null = null;
    if (req.nextUrl) {
      jobName = req.nextUrl.searchParams.get("job");
    } else {
      try {
        const url = new URL(req.url);
        jobName = url.searchParams.get("job");
      } catch {
        // ignore URL parse errors
      }
    }

    try {
      if (jobName) {
        // Run a specific job
        if (!clocktower.jobs.includes(jobName as keyof T & string)) {
          return new Response(
            JSON.stringify({ error: `Unknown job: "${jobName}"` }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const result = await clocktower.run(jobName as keyof T & string);
        return new Response(
          JSON.stringify({
            ok: result.success,
            job: jobName,
            result,
          }),
          {
            status: result.success ? 200 : 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Run all due jobs
      const results = await clocktower.runDue();
      const serialized: Record<string, JobResult> = {};
      for (const [name, result] of results) {
        serialized[name] = result;
      }

      const allSucceeded = [...results.values()].every((r) => r.success);

      return new Response(
        JSON.stringify({
          ok: allSucceeded,
          ran: results.size,
          results: serialized,
        }),
        {
          status: allSucceeded ? 200 : 207,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Internal error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };
}

/** Vercel cron configuration entry */
export interface VercelCronEntry {
  path: string;
  schedule: string;
}

/**
 * Generate the `crons` array for vercel.json.
 *
 * @example
 * ```ts
 * import { generateVercelCron } from "croncall/next";
 * import { tower } from "./jobs";
 *
 * // Output: [{ path: "/api/cron?job=syncUsers", schedule: "0 * * * *" }]
 * const crons = generateVercelCron(tower, "/api/cron");
 * ```
 */
export function generateVercelCron<T extends JobRegistry>(
  clocktower: ClockTower<T>,
  path: string = "/api/cron",
): VercelCronEntry[] {
  return clocktower.jobs.map((name) => ({
    path: `${path}?job=${name}`,
    schedule: clocktower.config.jobs[name].schedule,
  }));
}
