import { tower } from "@/lib/cron";

export async function GET(request: Request) {
  // Verify cron secret in production
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run all due jobs
  const results = await tower.runDue();
  const summary = Object.fromEntries(results);

  return Response.json({
    ran: results.size,
    results: summary,
    schedule: tower.schedule(),
  });
}
