import type {
  SifterConfig,
  SearchOptions,
  SearchResult,
  Sifter,
  InvertedIndex,
  SchemaDefinition,
} from "./types.js";
import { buildIndex } from "./index-builder.js";
import { search } from "./search.js";

/**
 * Create a Sifter instance for full-text search over a document collection.
 *
 * @example
 * ```ts
 * const sifter = createSifter({
 *   schema: { title: { weight: 2 }, body: true },
 *   documents: [{ title: "Hello", body: "World" }],
 * });
 * const results = sifter.search("hello");
 * ```
 */
export function createSifter<T>(config: SifterConfig<T>): Sifter<T> {
  const { schema } = config;
  let documents: T[] = [...config.documents];
  let index: InvertedIndex = buildIndex(documents, schema);

  return {
    search(query: string, options?: SearchOptions): SearchResult<T>[] {
      return search(index, documents, schema, query, options);
    },

    add(document: T): void {
      documents.push(document);
      // Rebuild index to include new document
      index = buildIndex(documents, schema);
    },

    remove(predicate: (item: T) => boolean): void {
      documents = documents.filter((doc) => !predicate(doc));
      index = buildIndex(documents, schema);
    },

    rebuild(): void {
      index = buildIndex(documents, schema);
    },

    get size(): number {
      return documents.length;
    },
  };
}
