import type {
  InvertedIndex,
  SchemaDefinition,
  SearchOptions,
  SearchResult,
  MatchInfo,
  ResolvedField,
  PostingEntry,
} from "./types.js";
import { tokenize, stem } from "./tokenizer.js";
import { resolveSchema } from "./index-builder.js";

/** BM25 parameters. */
const K1 = 1.2;
const B = 0.75;

/**
 * Compute Levenshtein edit distance between two strings.
 * Returns early if distance exceeds maxDist.
 */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      rowMin = Math.min(rowMin, dp[i]![j]!);
    }
    if (rowMin > maxDist) return maxDist + 1;
  }

  return dp[m]![n]!;
}

/**
 * Find fuzzy matches for a term in the index.
 * Returns all index terms within edit distance <= maxDist.
 */
function fuzzyTerms(
  index: InvertedIndex,
  term: string,
  maxDist: number,
): string[] {
  const matches: string[] = [];
  for (const indexTerm of index.keys()) {
    if (levenshtein(term, indexTerm, maxDist) <= maxDist) {
      matches.push(indexTerm);
    }
  }
  return matches;
}

/**
 * Compute the average document length across all fields.
 */
function computeAvgDocLength<T>(
  documents: T[],
  fields: ResolvedField[],
): number {
  if (documents.length === 0) return 0;
  let totalTokens = 0;
  for (const doc of documents) {
    for (const field of fields) {
      const val = getFieldValue(doc, field.name);
      if (val) {
        totalTokens += tokenize(val).length;
      }
    }
  }
  return totalTokens / documents.length;
}

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

/** Compute per-document token count for BM25 normalization. */
function docLength<T>(doc: T, fields: ResolvedField[]): number {
  let len = 0;
  for (const field of fields) {
    const val = getFieldValue(doc, field.name);
    if (val) len += tokenize(val).length;
  }
  return len;
}

/**
 * Search the inverted index with BM25 scoring.
 * Multi-term AND semantics: all query terms must match a document.
 */
export function search<T>(
  index: InvertedIndex,
  documents: T[],
  schema: SchemaDefinition,
  query: string,
  options: SearchOptions = {},
): SearchResult<T>[] {
  const {
    limit = 10,
    offset = 0,
    fuzzy = false,
    threshold = 0,
  } = options;

  const fields = resolveSchema(schema);
  const fieldWeights = new Map(fields.map((f) => [f.name, f.weight]));
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  const N = documents.length;
  const avgDl = computeAvgDocLength(documents, fields);

  // For each query term, collect the set of matching doc indices
  // and compute per-term BM25 contribution.
  const docScores = new Map<number, number>();
  const docMatches = new Map<number, Map<string, Set<number>>>();
  const termDocSets: Set<number>[] = [];

  for (const qToken of queryTokens) {
    // Find matching index terms (exact or fuzzy)
    let matchingTerms: string[];
    if (fuzzy) {
      matchingTerms = fuzzyTerms(index, qToken, 2);
      // Always include exact match if present
      if (index.has(qToken) && !matchingTerms.includes(qToken)) {
        matchingTerms.push(qToken);
      }
    } else {
      matchingTerms = index.has(qToken) ? [qToken] : [];
    }

    const termDocSet = new Set<number>();

    for (const term of matchingTerms) {
      const postings = index.get(term);
      if (!postings) continue;

      // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
      const df = postings.size;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const [docIdx, entries] of postings) {
        termDocSet.add(docIdx);

        const dl = docLength(documents[docIdx]!, fields);

        // Sum TF across all fields with weighting
        let weightedTf = 0;
        for (const entry of entries) {
          const w = fieldWeights.get(entry.field) ?? 1;
          weightedTf += entry.frequency * w;

          // Track match positions
          if (!docMatches.has(docIdx)) {
            docMatches.set(docIdx, new Map());
          }
          const fieldMap = docMatches.get(docIdx)!;
          if (!fieldMap.has(entry.field)) {
            fieldMap.set(entry.field, new Set());
          }
          const posSet = fieldMap.get(entry.field)!;
          for (const p of entry.positions) {
            posSet.add(p);
          }
        }

        // BM25 score for this term in this doc
        const tfNorm =
          (weightedTf * (K1 + 1)) /
          (weightedTf + K1 * (1 - B + B * (dl / (avgDl || 1))));
        const termScore = idf * tfNorm;

        docScores.set(docIdx, (docScores.get(docIdx) ?? 0) + termScore);
      }
    }

    termDocSets.push(termDocSet);
  }

  // AND semantics: only keep docs that matched ALL query terms
  let candidateDocs: Set<number>;
  if (termDocSets.length === 0) {
    candidateDocs = new Set();
  } else {
    candidateDocs = termDocSets[0]!;
    for (let i = 1; i < termDocSets.length; i++) {
      const next = new Set<number>();
      for (const docIdx of candidateDocs) {
        if (termDocSets[i]!.has(docIdx)) {
          next.add(docIdx);
        }
      }
      candidateDocs = next;
    }
  }

  // Build results
  const results: SearchResult<T>[] = [];
  for (const docIdx of candidateDocs) {
    const score = docScores.get(docIdx) ?? 0;
    if (score < threshold) continue;

    const matches: MatchInfo[] = [];
    const fieldMap = docMatches.get(docIdx);
    if (fieldMap) {
      for (const [field, posSet] of fieldMap) {
        const positions = Array.from(posSet)
          .sort((a, b) => a - b)
          .map((p): [number, number] => [p, p + 1]);
        matches.push({ field, positions });
      }
    }

    results.push({
      item: documents[docIdx]!,
      score,
      matches,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Apply offset and limit
  return results.slice(offset, offset + limit);
}
