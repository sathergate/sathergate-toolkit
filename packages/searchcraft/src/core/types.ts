/** Field configuration for search indexing. */
export interface FieldDefinition {
  /** Relative weight for scoring. Default: 1 */
  weight?: number;
  /** Whether this field is searchable. Default: true */
  searchable?: boolean;
}

/**
 * Schema definition mapping field names to their config.
 * Use `true` as shorthand for `{ weight: 1, searchable: true }`.
 */
export type SchemaDefinition = Record<string, FieldDefinition | boolean>;

/** Configuration for creating a Sifter instance. */
export interface SifterConfig<T> {
  schema: SchemaDefinition;
  documents: T[];
}

/** A single position match within a field. [startIndex, endIndex] */
export interface MatchInfo {
  field: string;
  positions: [number, number][];
}

/** A search result with score and match metadata. */
export interface SearchResult<T> {
  item: T;
  score: number;
  matches: MatchInfo[];
}

/** Options for search queries. */
export interface SearchOptions {
  /** Maximum number of results to return. */
  limit?: number;
  /** Number of results to skip (for pagination). */
  offset?: number;
  /** Enable fuzzy matching (Levenshtein distance <= 2). Default: false */
  fuzzy?: boolean;
  /** Minimum score threshold. Results below this are excluded. */
  threshold?: number;
}

/** Posting entry for a single document in the inverted index. */
export interface PostingEntry {
  frequency: number;
  positions: number[];
  field: string;
}

/** Inverted index: term -> docIndex -> posting entries */
export type InvertedIndex = Map<string, Map<number, PostingEntry[]>>;

/** Resolved field config (no boolean shorthand). */
export interface ResolvedField {
  name: string;
  weight: number;
  searchable: boolean;
}

/** The public Sifter interface. */
export interface Sifter<T> {
  search(query: string, options?: SearchOptions): SearchResult<T>[];
  add(document: T): void;
  remove(predicate: (item: T) => boolean): void;
  rebuild(): void;
  readonly size: number;
}
