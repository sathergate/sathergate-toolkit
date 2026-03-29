import type {
  InvertedIndex,
  SchemaDefinition,
  SearchOptions,
  SearchResult,
  MatchInfo,
  ResolvedField,
} from "./types.js";
import { tokenize } from "./tokenizer.js";
import { resolveSchema, getFieldValue } from "./index-builder.js";

/** BM25 parameters. */
const K1 = 1.2;
const B = 0.75;

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses two-row DP to avoid allocating a full matrix.
 * Returns early if distance exceeds maxDist.
 */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const m = a.length;
  const n = b.length;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
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
  const minLen = term.length - maxDist;
  const maxLen = term.length + maxDist;
  for (const indexTerm of index.keys()) {
    if (indexTerm.length < minLen || indexTerm.length > maxLen) continue;
    if (levenshtein(term, indexTerm, maxDist) <= maxDist) {
      matches.push(indexTerm);
    }
  }
  return matches;
}

/** Compute per-document token count for BM25 normalization (fallback path). */
function docLength<T>(doc: T, fields: ResolvedField[]): number {
  let len = 0;
  for (const field of fields) {
    const val = getFieldValue(doc, field.name);
    if (val) len += tokenize(val).length;
  }
  return len;
}

/** Pre-computed index metadata for BM25 scoring. */
export interface IndexMetadata {
  docLengths: Map<number, number>;
  avgDocLength: number;
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
  metadata?: IndexMetadata,
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

  // Use pre-computed metadata when available, otherwise compute once upfront
  let precomputedLengths: Map<number, number>;
  let avgDl: number;
  if (metadata) {
    precomputedLengths = metadata.docLengths;
    avgDl = metadata.avgDocLength;
  } else {
    precomputedLengths = new Map<number, number>();
    let total = 0;
    for (let i = 0; i < documents.length; i++) {
      const len = docLength(documents[i]!, fields);
      precomputedLengths.set(i, len);
      total += len;
    }
    avgDl = documents.length > 0 ? total / documents.length : 0;
  }

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

        const dl = precomputedLengths.get(docIdx) ?? 0;

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
