import { createClockTower } from "croncall";

export const tower = createClockTower({
  jobs: {
    cleanup: {
      schedule: "@daily",
      handler: async () => {
        console.log("[croncall] Running daily cleanup");
      },
      description: "Clean up stale data every day",
    },
    indexRefresh: {
      schedule: "*/30 * * * *",
      handler: async () => {
        console.log("[croncall] Refreshing search index");
      },
      description: "Refresh the search index every 30 minutes",
      retry: { maxAttempts: 2, backoff: "exponential" },
    },
  },
});
