/** Common English stop words. */
export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for",
  "from", "had", "has", "have", "he", "her", "his", "how", "i", "if",
  "in", "into", "is", "it", "its", "just", "me", "my", "no", "not",
  "of", "on", "or", "our", "out", "own", "say", "she", "so", "some",
  "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "to", "too", "up", "us", "very", "was", "we", "were",
  "what", "when", "which", "who", "will", "with", "would", "you", "your",
]);

/**
 * Simple Porter stemmer implementing basic suffix stripping rules.
 * Handles: -ing, -ed, -ly, -tion->t, -ies->y, -es->e, -s
 */
export function stem(word: string): string {
  if (word.length < 3) return word;

  // -tion -> t
  if (word.endsWith("tion")) {
    return word.slice(0, -3);
  }

  // -ies -> y
  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }

  // -ing (but not if it would leave < 3 chars)
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    // handle doubling: running -> run
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // -ed (but not "need", "feed", etc.)
  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // -ly
  if (word.endsWith("ly") && word.length > 4) {
    return word.slice(0, -2);
  }

  // -es -> e (but not "es" alone)
  if (word.endsWith("es") && word.length > 4) {
    return word.slice(0, -1);
  }

  // -s (but not -ss, and not if it would leave < 3 chars)
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Tokenize text into stemmed, lowercased terms with stopwords removed.
 * Returns an array of tokens (may contain duplicates for frequency counting).
 */
export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const tokens: string[] = [];
  for (const word of raw) {
    if (STOPWORDS.has(word)) continue;
    tokens.push(stem(word));
  }
  return tokens;
}
