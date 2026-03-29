import type {
  Flagpost,
  FlagDefinitions,
  FlagContext,
  FlagValue,
  ExtractFlags,
  ExtractFlagNames,
} from "./core/types.js";

// Minimal type declarations for Next.js middleware types.
// We declare only what we need to avoid module resolution issues
// with next/server across different TypeScript configurations.

/** Minimal interface representing a Next.js middleware request. */
interface NextMiddlewareRequest {
  headers: Headers;
  cookies: {
    get(name: string): { value: string } | undefined;
  };
  geo?: {
    country?: string;
    region?: string;
    city?: string;
  };
  nextUrl: URL;
  url: string;
}

/** Minimal interface representing a Next.js middleware response. */
interface NextMiddlewareResponse {
  headers: Headers;
  cookies: {
    set(name: string, value: string): void;
  };
}

/**
 * Evaluate a single flag on the server.
 *
 * Use in Server Components, Route Handlers, or server actions.
 *
 * @example
 * ```ts
 * // app/page.tsx (Server Component)
 * import { flag } from "flagpost/next";
 * import { fp } from "@/lib/flags";
 *
 * export default async function Page() {
 *   const darkMode = await flag(fp, "darkMode");
 *   return <div className={darkMode ? "dark" : ""}>...</div>;
 * }
 * ```
 */
export async function flag<
  T extends FlagDefinitions,
  K extends ExtractFlagNames<T>,
>(
  flagpost: Flagpost<T>,
  name: K,
  context?: FlagContext,
): Promise<ExtractFlags<T>[K]> {
  const ctx = context ?? (await flagpost.resolveContext());
  return flagpost.evaluate(name, ctx);
}

/**
 * Evaluate all flags on the server.
 *
 * @example
 * ```ts
 * const allFlags = await flags(fp);
 * if (allFlags.darkMode) { ... }
 * ```
 */
export async function flags<T extends FlagDefinitions>(
  flagpost: Flagpost<T>,
  context?: FlagContext,
): Promise<ExtractFlags<T>> {
  const ctx = context ?? (await flagpost.resolveContext());
  return flagpost.evaluateAll(ctx);
}

/**
 * Options for the flag middleware.
 */
export interface FlagMiddlewareOptions {
  /** Header prefix for flag values. Defaults to "x-flag-". */
  headerPrefix?: string;
}

/**
 * Creates a Next.js middleware handler that evaluates all flags and sets them
 * as request headers (e.g., `x-flag-dark-mode: true`).
 *
 * Downstream Server Components and Route Handlers can read these headers
 * via `headers()` from `next/headers`.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { createFlagMiddleware } from "flagpost/next";
 * import { fp } from "@/lib/flags";
 *
 * const withFlags = createFlagMiddleware(fp, (req) => ({
 *   userId: req.cookies.get("userId")?.value ?? "anonymous",
 *   country: req.geo?.country ?? "US",
 * }));
 *
 * export function middleware(req: NextRequest) {
 *   return withFlags(req);
 * }
 * ```
 */
export function createFlagMiddleware<T extends FlagDefinitions>(
  flagpost: Flagpost<T>,
  contextResolver: (
    req: NextMiddlewareRequest,
  ) => FlagContext | Promise<FlagContext>,
  options?: FlagMiddlewareOptions,
): (req: NextMiddlewareRequest) => Promise<NextMiddlewareResponse> {
  const prefix = options?.headerPrefix ?? "x-flag-";

  return async (
    req: NextMiddlewareRequest,
  ): Promise<NextMiddlewareResponse> => {
    // Dynamic import to avoid requiring next at module load time
    const { NextResponse } = await import("next/server" as string);

    const ctx = await contextResolver(req);
    const evaluated = flagpost.evaluateAll(ctx);

    // Clone the request headers and add flag values
    const requestHeaders = new Headers(req.headers);
    for (const [name, value] of Object.entries(
      evaluated as Record<string, FlagValue>,
    )) {
      const headerName = `${prefix}${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      requestHeaders.set(headerName, String(value));
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };
}
