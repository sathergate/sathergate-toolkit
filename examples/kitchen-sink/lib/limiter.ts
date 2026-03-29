import { createFloodgate } from "ratelimit-next";

export const limiter = createFloodgate({
  rules: {
    search: { limit: 30, window: "1m" },
    api: { limit: 60, window: "1m" },
  },
});
