import { limiter } from "@/lib/limiter";
import type { SignalItem, ItemType } from "@/lib/types";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await limiter.check("submit", ip);

  if (!result.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: limiter.headers(result) }
    );
  }

  const body = await request.json() as {
    title: string;
    url: string;
    type: ItemType;
    description?: string;
  };

  const now = new Date().toISOString();
  const ageHours = 0;
  const votes = 1;
  const trendingScore = votes / Math.pow(ageHours + 2, 1.5);

  const item: SignalItem = {
    id: crypto.randomUUID(),
    type: body.type,
    title: body.title,
    description: body.description ?? "",
    url: body.url,
    tags: [],
    votes,
    comments: 0,
    submittedAt: now,
    trendingScore,
    source: (() => {
      try { return new URL(body.url).hostname; } catch { return undefined; }
    })(),
  };

  return Response.json(item, { status: 201, headers: limiter.headers(result) });
}
