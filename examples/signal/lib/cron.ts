import { createClockTower } from "croncall";
import type { SignalItem } from "./types";
import { SEED_DATA } from "./data";

// In a real app: import { createLockbox } from "vaultbox"
// const box = createLockbox()
// const secret = box.require("CRON_SECRET")
// Here we read from env directly for portability in the demo
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

function computeScore(item: SignalItem): number {
  const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000;
  return item.votes / Math.pow(ageHours + 2, 1.5);
}

export const tower = createClockTower({
  jobs: {
    trending: {
      schedule: "0 * * * *",
      handler: async () => {
        // In a real app this would write to a DB.
        // Here we return updated scores for inspection.
        return SEED_DATA.map((item) => ({
          id: item.id,
          trendingScore: computeScore(item),
        }));
      },
      description: "Recompute trending scores hourly",
    },
  },
  secret: CRON_SECRET || undefined,
});
