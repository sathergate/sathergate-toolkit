import { sifter } from "@/lib/search";
import { limiter } from "@/lib/limiter";

export async function GET(request: Request) {
  // Rate-limit search requests
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await limiter.check("search", ip);

  if (!result.allowed) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: limiter.headers(result),
      },
    );
  }

  // Parse search query
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const fuzzy = url.searchParams.get("fuzzy") === "true";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "10")));

  if (!q) {
    return Response.json({ results: [], query: "", count: 0 });
  }

  const results = sifter.search(q, { limit, fuzzy });

  return Response.json(
    {
      query: q,
      count: results.length,
      results: results.map((r) => ({
        item: r.item,
        score: r.score,
      })),
    },
    { headers: limiter.headers(result) },
  );
}
