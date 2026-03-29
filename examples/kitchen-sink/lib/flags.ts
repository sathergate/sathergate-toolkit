import { createFlagpost } from "flagpost";

export const fp = createFlagpost({
  flags: {
    showBanner: {
      defaultValue: true,
      description: "Show the welcome banner on the homepage",
    },
    darkMode: {
      defaultValue: false,
      description: "Enable dark mode styling",
      rules: [{ value: true, percentage: 50 }],
    },
    newSearch: {
      defaultValue: false,
      description: "Enable the new fuzzy search experience",
      rules: [
        { value: true, match: { beta: true } },
      ],
    },
  },
});
