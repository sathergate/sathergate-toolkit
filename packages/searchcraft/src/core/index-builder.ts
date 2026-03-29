import type {
  SchemaDefinition,
  InvertedIndex,
  ResolvedField,
  PostingEntry,
} from "./types.js";
import { tokenize } from "./tokenizer.js";

/** Resolve schema shorthand into full field definitions. */
export function resolveSchema(schema: SchemaDefinition): ResolvedField[] {
  const fields: ResolvedField[] = [];
  for (const [name, def] of Object.entries(schema)) {
    if (def === true) {
      fields.push({ name, weight: 1, searchable: true });
    } else if (def === false) {
      fields.push({ name, weight: 1, searchable: false });
    } else {
      fields.push({
        name,
        weight: def.weight ?? 1,
        searchable: def.searchable ?? true,
      });
    }
  }
  return fields.filter((f) => f.searchable);
}

/** Extract the value of a (possibly nested) field from a document. */
function getFieldValue(doc: unknown, fieldName: string): string {
  const parts = fieldName.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current == null) return "";
  if (Array.isArray(current)) return current.join(" ");
  return String(current);
}

/** Result of building an index, including pre-computed metadata. */
export interface IndexResult {
  index: InvertedIndex;
  docLengths: Map<number, number>;
  totalTokens: number;
}

/**
 * Index a single document into an existing inverted index.
 * Returns the token count for the document (used for BM25 doc length).
 */
export function indexDocument<T>(
  index: InvertedIndex,
  doc: T,
  docIdx: number,
  fields: ResolvedField[],
): number {
  let docTokenCount = 0;

  for (const field of fields) {
    const text = getFieldValue(doc, field.name);
    if (!text) continue;

    const tokens = tokenize(text);
    docTokenCount += tokens.length;

    for (let pos = 0; pos < tokens.length; pos++) {
      const term = tokens[pos]!;

      if (!index.has(term)) {
        index.set(term, new Map());
      }
      const termMap = index.get(term)!;

      if (!termMap.has(docIdx)) {
        termMap.set(docIdx, []);
      }
      const entries = termMap.get(docIdx)!;

      let entry = entries.find((e) => e.field === field.name);
      if (!entry) {
        entry = { frequency: 0, positions: [], field: field.name };
        entries.push(entry);
      }
      entry.frequency++;
      entry.positions.push(pos);
    }
  }

  return docTokenCount;
}

/**
 * Build an inverted index from a set of documents and schema.
 * Each term maps to a Map of docIndex -> PostingEntry[].
 * Returns the index along with pre-computed document lengths.
 */
export function buildIndex<T>(
  documents: T[],
  schema: SchemaDefinition,
): IndexResult {
  const fields = resolveSchema(schema);
  const index: InvertedIndex = new Map();
  const docLengths = new Map<number, number>();
  let totalTokens = 0;

  for (let docIdx = 0; docIdx < documents.length; docIdx++) {
    const tokenCount = indexDocument(index, documents[docIdx], docIdx, fields);
    docLengths.set(docIdx, tokenCount);
    totalTokens += tokenCount;
  }

  return { index, docLengths, totalTokens };
}

/** Count total documents in the corpus. */
export function documentCount<T>(documents: T[]): number {
  return documents.length;
}
