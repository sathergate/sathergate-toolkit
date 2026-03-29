import type { Sifter, SearchOptions } from "./core/types.js";

/**
 * Create a Next.js Route Handler for search.
 *
 * @example
 * ```ts
 * // app/api/search/route.ts
 * import { createSearchHandler } from "searchcraft/next";
 * import { sifter } from "@/lib/search";
 *
 * export const GET = createSearchHandler(sifter);
 * ```
 *
 * Query parameters:
 * - `q` — search query (required)
 * - `limit` — max results (default: 10)
 * - `offset` — skip N results (default: 0)
 * - `fuzzy` — enable fuzzy matching ("true" | "1")
 * - `threshold` — minimum score
 */
export function createSearchHandler<T>(sifter: Sifter<T>) {
  return function handler(request: Request): Response {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const fuzzyParam = url.searchParams.get("fuzzy");
    const thresholdParam = url.searchParams.get("threshold");

    if (!q.trim()) {
      return Response.json({ results: [], query: q, total: 0 });
    }

    const options: SearchOptions = {};
    if (limitParam != null) options.limit = parseInt(limitParam, 10) || 10;
    if (offsetParam != null) options.offset = parseInt(offsetParam, 10) || 0;
    if (fuzzyParam === "true" || fuzzyParam === "1") options.fuzzy = true;
    if (thresholdParam != null)
      options.threshold = parseFloat(thresholdParam) || 0;

    const results = sifter.search(q, options);

    return Response.json({
      results: results.map((r) => ({
        item: r.item,
        score: Math.round(r.score * 1000) / 1000,
        matches: r.matches,
      })),
      query: q,
      total: results.length,
    });
  };
}
