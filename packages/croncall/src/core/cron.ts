/**
 * Zero-dependency cron expression parser and matcher.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Supports shortcuts: @yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly
 */

/** Parsed representation of a cron expression */
export interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

const SHORTCUTS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function replaceNames(field: string, names: Record<string, number>): string {
  let result = field.toLowerCase();
  for (const [name, value] of Object.entries(names)) {
    result = result.replaceAll(name, String(value));
  }
  return result;
}

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const rangePart = stepMatch ? stepMatch[1] : part;

    let rangeMin: number;
    let rangeMax: number;

    if (rangePart === "*") {
      rangeMin = min;
      rangeMax = max;
    } else {
      const dashMatch = rangePart.match(/^(\d+)-(\d+)$/);
      if (dashMatch) {
        rangeMin = parseInt(dashMatch[1], 10);
        rangeMax = parseInt(dashMatch[2], 10);
      } else {
        const val = parseInt(rangePart, 10);
        if (isNaN(val) || val < min || val > max) {
          throw new Error(`Invalid cron field value: "${part}" (expected ${min}-${max})`);
        }
        values.add(val);
        continue;
      }
    }

    if (rangeMin < min || rangeMax > max || rangeMin > rangeMax) {
      throw new Error(`Invalid cron range: ${rangeMin}-${rangeMax} (expected ${min}-${max})`);
    }

    for (let i = rangeMin; i <= rangeMax; i += step) {
      values.add(i);
    }
  }

  return values;
}

/**
 * Parse a cron expression into its component parts.
 * @param expression - Standard 5-field cron or shortcut (@hourly, etc.)
 */
export function parseCron(expression: string): ParsedCron {
  const normalized = SHORTCUTS[expression.trim().toLowerCase()] ?? expression.trim();
  const fields = normalized.split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression: "${expression}". Expected 5 fields (minute hour day-of-month month day-of-week) or a shortcut (@hourly, @daily, @weekly, @monthly).`
    );
  }

  const [minuteField, hourField, domField, monthField, dowField] = fields;

  return {
    minutes: parseField(minuteField, 0, 59),
    hours: parseField(hourField, 0, 23),
    daysOfMonth: parseField(domField, 1, 31),
    months: parseField(replaceNames(monthField, MONTH_NAMES), 1, 12),
    daysOfWeek: parseField(replaceNames(dowField, DAY_NAMES), 0, 6),
  };
}

/**
 * Check if a cron expression matches a given date (to the minute).
 * Accepts either a cron expression string or a pre-parsed ParsedCron.
 * @param expressionOrParsed - Cron expression string or ParsedCron
 * @param date - Date to check against
 */
export function matchesCron(expressionOrParsed: string | ParsedCron, date: Date): boolean {
  const cron = typeof expressionOrParsed === "string" ? parseCron(expressionOrParsed) : expressionOrParsed;
  return (
    cron.minutes.has(date.getUTCMinutes()) &&
    cron.hours.has(date.getUTCHours()) &&
    cron.daysOfMonth.has(date.getUTCDate()) &&
    cron.months.has(date.getUTCMonth() + 1) &&
    cron.daysOfWeek.has(date.getUTCDay())
  );
}

/**
 * Calculate the next time a cron expression will match, after the given date.
 * Accepts either a cron expression string or a pre-parsed ParsedCron.
 * @param expressionOrParsed - Cron expression string or ParsedCron
 * @param after - Start searching after this date (default: now)
 * @returns The next Date the cron will fire
 */
export function nextRun(expressionOrParsed: string | ParsedCron, after?: Date): Date {
  const cron = typeof expressionOrParsed === "string" ? parseCron(expressionOrParsed) : expressionOrParsed;
  const start = after ? new Date(after.getTime()) : new Date();

  // Advance to the next minute boundary
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  // Search up to 4 years ahead (covers all cron patterns)
  const limit = new Date(start.getTime() + 4 * 365 * 24 * 60 * 60 * 1000);
  const candidate = new Date(start.getTime());

  while (candidate.getTime() < limit.getTime()) {
    // Check month
    if (!cron.months.has(candidate.getUTCMonth() + 1)) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }

    // Check day of month and day of week
    if (
      !cron.daysOfMonth.has(candidate.getUTCDate()) ||
      !cron.daysOfWeek.has(candidate.getUTCDay())
    ) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }

    // Check hour
    if (!cron.hours.has(candidate.getUTCHours())) {
      candidate.setUTCHours(candidate.getUTCHours() + 1, 0, 0, 0);
      continue;
    }

    // Check minute
    if (!cron.minutes.has(candidate.getUTCMinutes())) {
      candidate.setUTCMinutes(candidate.getUTCMinutes() + 1, 0, 0);
      continue;
    }

    return candidate;
  }

  throw new Error(`No matching time found for cron expression "${expressionOrParsed}" within 4 years`);
}
