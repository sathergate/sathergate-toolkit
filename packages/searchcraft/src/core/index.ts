export { createSifter } from "./sifter.js";
export { buildIndex, indexDocument, resolveSchema } from "./index-builder.js";
export type { IndexResult } from "./index-builder.js";
export { search } from "./search.js";
export type { IndexMetadata } from "./search.js";
export { tokenize, stem, STOPWORDS } from "./tokenizer.js";
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
} from "./types.js";
