import { tower, CRON_SECRET } from "@/lib/cron";
import { createCronHandler } from "croncall/next";

// Validate secret before delegating to croncall handler
export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return createCronHandler(tower)(request);
}
