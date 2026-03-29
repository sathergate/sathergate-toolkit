export { createSifter } from "./core/sifter.js";
export { buildIndex, resolveSchema } from "./core/index-builder.js";
export { search } from "./core/search.js";
export { tokenize, stem, STOPWORDS } from "./core/tokenizer.js";
export type {
  FieldDefinition,
  SchemaDefinition,
  SifterConfig,
  SearchResult,
  MatchInfo,
  SearchOptions,
  Sifter,
  InvertedIndex,
  PostingEntry,
  ResolvedField,
} from "./core/types.js";
