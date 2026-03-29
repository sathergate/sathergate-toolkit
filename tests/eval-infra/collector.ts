/**
 * Eval Data Collector
 *
 * Accumulates structured eval records during test runs. Each record represents
 * a labeled data point that can be consumed by:
 * - Post-training fine-tuning pipelines (labeled preference data)
 * - Production quality dashboards (regression detection)
 * - Hill-climbing optimization loops (A/B test description variants)
 *
 * Records are flushed to eval-output/ as JSONL when flush() is called.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type EvalCategory =
  | "discovery"
  | "selection"
  | "implementation"
  | "composability"
  | "contract";

export interface EvalRecord {
  category: EvalCategory;
  input: string;
  expected: string;
  actual: string;
  score: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  version?: string;
}

const records: EvalRecord[] = [];

export function record(entry: EvalRecord): void {
  records.push({
    ...entry,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    version: entry.version ?? "0.1.0",
  });
}

export function getRecords(): readonly EvalRecord[] {
  return records;
}

export function clear(): void {
  records.length = 0;
}

export function flush(outputDir?: string): void {
  if (records.length === 0) return;

  const dir = outputDir ?? join(process.cwd(), "eval-output");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);

  // Group by category and write separate JSONL files
  const byCategory = new Map<EvalCategory, EvalRecord[]>();
  for (const r of records) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  for (const [category, entries] of byCategory) {
    const filePath = join(dir, `${category}-${date}.jsonl`);
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(filePath, lines, { flag: "a" }); // append
  }
}
