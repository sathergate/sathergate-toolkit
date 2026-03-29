/**
 * Vitest Custom Reporter for Eval Data Collection
 *
 * When EVAL_COLLECT=1, this reporter enriches eval records with test metadata
 * (file, suite, duration) and flushes all collected eval data to disk after
 * the test run completes.
 *
 * Usage: EVAL_COLLECT=1 vitest run
 * Output: eval-output/{category}-{date}.jsonl
 */

import type { Reporter, File } from "vitest";
import { flush, getRecords } from "./collector.js";

export default class EvalReporter implements Reporter {
  onFinished(_files?: File[], _errors?: unknown[]): void {
    const records = getRecords();
    if (records.length > 0) {
      flush();
      console.log(
        `\n[eval-reporter] Flushed ${records.length} eval records to eval-output/`,
      );
    }
  }
}
