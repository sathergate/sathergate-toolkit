import { tower, CRON_SECRET } from "@/lib/cron";
import { createCronHandler } from "croncall/next";

// Guard required: createCronHandler skips auth entirely when no secret is
// configured. This ensures 401 when CRON_SECRET is unset, not an open endpoint.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return createCronHandler(tower)(request);
}
