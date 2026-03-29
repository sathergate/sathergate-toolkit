import { sifter } from "@/lib/search";
import { limiter } from "@/lib/limiter";

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await limiter.check("search", ip);

  if (!result.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: limiter.headers(result) }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const fuzzy = searchParams.get("fuzzy") === "true";

  if (!q.trim()) {
    return Response.json(
      { results: [], count: 0 },
      { headers: limiter.headers(result) }
    );
  }

  const results = sifter.search(q, { limit: 20, fuzzy });

  return Response.json(
    { results: results.map((r) => r.item), count: results.length },
    { headers: limiter.headers(result) }
  );
}
