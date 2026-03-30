import { createSifter } from "searchcraft";
import { SEED_DATA } from "./data";

export const sifter = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: true,
  },
  documents: SEED_DATA,
});
