/** Standard 5-field cron expression or shortcut (@hourly, @daily, etc.) */
export type CronExpression = string;

/** Retry configuration for failed jobs */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 0) */
  maxAttempts: number;
  /** Backoff strategy between retries */
  backoff: "exponential" | "linear";
  /** Base delay in ms between retries (default: 1000) */
  baseDelay?: number;
}

/** Definition of a scheduled job */
export interface JobDefinition {
  /** Cron schedule expression (e.g. "0 * * * *" or "@hourly") */
  schedule: CronExpression;
  /** Async function to execute when the job runs */
  handler: () => Promise<void>;
  /** Human-readable description of what this job does */
  description?: string;
  /** Retry configuration for failed executions */
  retry?: RetryConfig;
  /** Maximum execution time in milliseconds before the job is aborted */
  timeout?: number;
}

/** A map of job names to their definitions */
export type JobRegistry = Record<string, JobDefinition>;

/** Configuration for a ClockTower instance */
export interface ClockTowerConfig<T extends JobRegistry = JobRegistry> {
  /** Map of job names to job definitions */
  jobs: T;
  /** Secret used to authenticate cron requests (checked against Authorization header) */
  secret?: string;
  /** IANA timezone for schedule evaluation (default: "UTC") */
  timezone?: string;
}

/** Result of a single job execution */
export interface JobResult {
  /** Whether the job completed successfully */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if the job failed */
  error?: string;
  /** Number of retries that were attempted */
  retryCount?: number;
}

/** Record of a job execution */
export interface JobExecution {
  /** Name of the job that was executed */
  jobName: string;
  /** When the execution started */
  startedAt: Date;
  /** When the execution completed */
  completedAt: Date;
  /** Result of the execution */
  result: JobResult;
}

/** Schedule entry for a job */
export interface ScheduleEntry {
  /** Name of the job */
  jobName: string;
  /** When the job will next run */
  nextRun: Date;
  /** The cron schedule expression */
  schedule: CronExpression;
  /** Human-readable description */
  description?: string;
}

/** The ClockTower instance interface */
export interface ClockTower<T extends JobRegistry = JobRegistry> {
  /** Run a specific job immediately */
  run(jobName: keyof T & string): Promise<JobResult>;
  /** Run all jobs that are due at the given time */
  runDue(now?: Date): Promise<Map<string, JobResult>>;
  /** Get the next run time for a specific job */
  nextRun(jobName: keyof T & string): Date;
  /** Get the full schedule for all jobs */
  schedule(): ScheduleEntry[];
  /** Readonly list of all job names */
  readonly jobs: ReadonlyArray<keyof T & string>;
  /** The configuration */
  readonly config: ClockTowerConfig<T>;
}
