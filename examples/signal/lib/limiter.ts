import { createFloodgate } from "ratelimit-next";

export const limiter = createFloodgate({
  rules: {
    search: { limit: 60, window: "1m" },
    submit: { limit: 5, window: "1h", algorithm: "fixed-window" },
  },
});
