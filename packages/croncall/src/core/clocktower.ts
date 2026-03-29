import { parseCron, matchesCron, nextRun, type ParsedCron } from "./cron.js";
import type {
  ClockTower,
  ClockTowerConfig,
  JobRegistry,
  JobResult,
  ScheduleEntry,
} from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(
  attempt: number,
  backoff: "exponential" | "linear",
  baseDelay: number,
): number {
  if (backoff === "exponential") {
    return baseDelay * Math.pow(2, attempt);
  }
  return baseDelay * (attempt + 1);
}

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number | undefined,
): Promise<T> {
  if (!timeoutMs) return fn();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Job timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Create a ClockTower instance from a configuration.
 *
 * @example
 * ```ts
 * const tower = createClockTower({
 *   jobs: {
 *     syncUsers: {
 *       schedule: "0 * * * *",
 *       handler: async () => { await db.syncUsers(); },
 *       description: "Sync users from external API every hour",
 *       retry: { maxAttempts: 3, backoff: "exponential" },
 *       timeout: 30_000,
 *     },
 *   },
 *   secret: process.env.CRON_SECRET,
 * });
 * ```
 */
export function createClockTower<T extends JobRegistry>(
  config: ClockTowerConfig<T>,
): ClockTower<T> {
  const jobNames = Object.keys(config.jobs) as Array<keyof T & string>;

  // Validate and cache all parsed cron expressions eagerly
  const parsedCrons = new Map<string, ParsedCron>();
  for (const name of jobNames) {
    try {
      parsedCrons.set(name, parseCron(config.jobs[name].schedule));
    } catch (err) {
      throw new Error(
        `Invalid cron expression for job "${name}": ${(err as Error).message}`,
      );
    }
  }

  async function run(jobName: keyof T & string): Promise<JobResult> {
    const job = config.jobs[jobName];
    if (!job) {
      return {
        success: false,
        duration: 0,
        error: `Unknown job: "${jobName}"`,
      };
    }

    const maxAttempts = (job.retry?.maxAttempts ?? 0) + 1;
    const backoff = job.retry?.backoff ?? "exponential";
    const baseDelay = job.retry?.baseDelay ?? 1000;

    let lastError: string | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        retryCount = attempt;
        const delay = computeDelay(attempt - 1, backoff, baseDelay);
        await sleep(delay);
      }

      const start = Date.now();
      try {
        await runWithTimeout(job.handler, job.timeout);
        return {
          success: true,
          duration: Date.now() - start,
          retryCount: retryCount > 0 ? retryCount : undefined,
        };
      } catch (err) {
        lastError =
          err instanceof Error ? err.message : String(err);
      }
    }

    return {
      success: false,
      duration: 0,
      error: lastError,
      retryCount: retryCount > 0 ? retryCount : undefined,
    };
  }

  async function runDue(now?: Date): Promise<Map<string, JobResult>> {
    const checkTime = now ?? new Date();
    const results = new Map<string, JobResult>();

    const dueJobs = jobNames.filter((name) =>
      matchesCron(parsedCrons.get(name)!, checkTime),
    );

    const entries = await Promise.allSettled(
      dueJobs.map(async (name) => {
        const result = await run(name);
        return [name, result] as const;
      }),
    );

    for (const entry of entries) {
      if (entry.status === "fulfilled") {
        results.set(entry.value[0], entry.value[1]);
      }
    }

    return results;
  }

  function getNextRun(jobName: keyof T & string): Date {
    const job = config.jobs[jobName];
    if (!job) {
      throw new Error(`Unknown job: "${jobName}"`);
    }
    return nextRun(parsedCrons.get(jobName)!);
  }

  function getSchedule(): ScheduleEntry[] {
    return jobNames.map((name) => ({
      jobName: name,
      nextRun: nextRun(parsedCrons.get(name)!),
      schedule: config.jobs[name].schedule,
      description: config.jobs[name].description,
    }));
  }

  return {
    run,
    runDue,
    nextRun: getNextRun,
    schedule: getSchedule,
    jobs: jobNames,
    config,
  };
}
