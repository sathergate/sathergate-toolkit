import type {
  SifterConfig,
  SearchOptions,
  SearchResult,
  Sifter,
  InvertedIndex,
  SchemaDefinition,
} from "./types.js";
import { buildIndex, indexDocument, resolveSchema } from "./index-builder.js";
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
  const fields = resolveSchema(schema);
  let documents: T[] = [...config.documents];

  let { index, docLengths, totalTokens } = buildIndex(documents, schema);

  function rebuildFull(): void {
    const result = buildIndex(documents, schema);
    index = result.index;
    docLengths = result.docLengths;
    totalTokens = result.totalTokens;
  }

  return {
    search(query: string, options?: SearchOptions): SearchResult<T>[] {
      const avgDl = documents.length > 0 ? totalTokens / documents.length : 0;
      return search(index, documents, schema, query, options, {
        docLengths,
        avgDocLength: avgDl,
      });
    },

    add(document: T): void {
      const docIdx = documents.length;
      documents.push(document);
      const tokenCount = indexDocument(index, document, docIdx, fields);
      docLengths.set(docIdx, tokenCount);
      totalTokens += tokenCount;
    },

    remove(predicate: (item: T) => boolean): void {
      documents = documents.filter((doc) => !predicate(doc));
      rebuildFull();
    },

    rebuild(): void {
      rebuildFull();
    },

    get size(): number {
      return documents.length;
    },
  };
}
