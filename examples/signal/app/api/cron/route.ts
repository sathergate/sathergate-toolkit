import { tower, CRON_SECRET } from "@/lib/cron";
import { SEED_DATA } from "@/lib/data";

// Guard required: createCronHandler skips auth entirely when no secret is
// configured. This ensures 401 when CRON_SECRET is unset, not an open endpoint.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run the trending job through croncall (handles retry config, scheduling)
  await tower.run("trending");

  // croncall discards the handler's return value, so we recompute scores here
  // for the response. This is explicitly a local-dev inspection pattern.
  const scores = SEED_DATA.map((item) => {
    const ageHours = (Date.now() - Date.parse(item.submittedAt)) / 3_600_000;
    return { ...item, trendingScore: item.votes / Math.pow(ageHours + 2, 1.5) };
  });

  return Response.json({ job: "trending", scores });
}
