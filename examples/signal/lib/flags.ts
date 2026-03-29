import { createFlagpost } from "flagpost";

export const fp = createFlagpost({
  flags: {
    new_feed_layout: {
      defaultValue: false,
      description: "Card layout variant — 50% rollout",
      rules: [{ value: true, percentage: 50 }],
    },
  },
});
