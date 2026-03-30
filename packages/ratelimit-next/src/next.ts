import type { NextRequest } from "next/server.js";
import { NextResponse } from "next/server.js";
import type { Floodgate } from "./core/floodgate.js";
import type { RateLimitResult, KeyResolver } from "./core/types.js";
import { RateLimitError } from "./core/types.js";

/** Default key resolver: extracts IP from standard headers. */
function defaultKeyResolver(request: Request): string {
  // Next.js sets these headers in middleware
  const forwarded =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}

export interface RateLimitMiddlewareOptions {
  /** Which rule to apply. If omitted, picks the first rule. */
  rule?: string;
  /** Custom key resolver. Defaults to IP-based. */
  keyResolver?: KeyResolver;
  /** Paths to match (glob-style prefixes). If omitted, matches all. */
  paths?: string[];
  /** Custom response when rate limited. */
  onRateLimited?: (
    request: NextRequest,
    result: RateLimitResult
  ) => NextResponse | Response;
}

/**
 * Create Next.js middleware that enforces rate limits.
 *
 * @example
 * // middleware.ts
 * import { createFloodgate } from "ratelimit-next";
 * import { createRateLimitMiddleware } from "ratelimit-next/next";
 *
 * const gate = createFloodgate({ rules: { api: { limit: 100, window: "1m" } } });
 * export default createRateLimitMiddleware(gate, { rule: "api", paths: ["/api/"] });
 */
export function createRateLimitMiddleware(
  floodgate: Floodgate,
  options: RateLimitMiddlewareOptions = {}
) {
  const {
    rule,
    keyResolver = defaultKeyResolver,
    paths,
    onRateLimited,
  } = options;

  const ruleName = rule ?? Object.keys(floodgate.rules)[0] ?? "default";

  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | Response> {
    // Path filtering
    if (paths && paths.length > 0) {
      const pathname = request.nextUrl.pathname;
      const matches = paths.some((p) => pathname.startsWith(p));
      if (!matches) {
        return NextResponse.next();
      }
    }

    const key = await keyResolver(request);
    const result = await floodgate.check(ruleName, key);
    const headers = floodgate.headers(result);

    if (!result.allowed) {
      if (onRateLimited) {
        return onRateLimited(request, result);
      }
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...headers },
        }
      );
    }

    const response = NextResponse.next();
    for (const [k, v] of Object.entries(headers)) {
      response.headers.set(k, v);
    }
    return response;
  };
}

/**
 * Rate limit a Next.js API route handler.
 * Returns a 429 response if the limit is exceeded.
 *
 * @example
 * import { rateLimit } from "ratelimit-next/next";
 *
 * export async function GET(request: Request) {
 *   const limited = await rateLimit(gate, "api", request);
 *   if (limited) return limited;
 *   return Response.json({ ok: true });
 * }
 */
export async function rateLimit(
  floodgate: Floodgate,
  ruleName: string,
  request?: Request
): Promise<Response | null> {
  const key = request
    ? defaultKeyResolver(request)
    : "global";

  const result = await floodgate.check(ruleName, key);
  const headers = floodgate.headers(result);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...headers },
      }
    );
  }

  return null;
}

type RouteHandler = (
  request: Request,
  context?: any
) => Response | Promise<Response>;

/**
 * Higher-order function that wraps a Next.js route handler with rate limiting.
 *
 * @example
 * import { withRateLimit } from "ratelimit-next/next";
 *
 * export const GET = withRateLimit(gate, "api", async (request) => {
 *   return Response.json({ data: "hello" });
 * });
 */
export function withRateLimit(
  floodgate: Floodgate,
  ruleName: string,
  handler: RouteHandler
): RouteHandler {
  return async (request: Request, context?: any) => {
    const key = defaultKeyResolver(request);
    const result = await floodgate.check(ruleName, key);
    const headers = floodgate.headers(result);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...headers },
        }
      );
    }

    const response = await handler(request, context);
    const newResponse = new Response(response.body, response);
    for (const [k, v] of Object.entries(headers)) {
      newResponse.headers.set(k, v);
    }
    return newResponse;
  };
}
