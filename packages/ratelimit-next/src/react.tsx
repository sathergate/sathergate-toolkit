"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

/** Rate limit state exposed by the useRateLimit hook. */
export interface RateLimitState {
  /** Whether the current user is allowed to proceed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Timestamp (ms) when the window resets. */
  reset: number;
  /** Re-check the rate limit by calling the server endpoint. */
  check: () => Promise<void>;
  /** Whether a check is currently in progress. */
  loading: boolean;
}

interface RateLimitContextValue {
  /** Endpoint to check rate limits against. */
  endpoint: string;
}

const RateLimitContext = createContext<RateLimitContextValue>({
  endpoint: "/api/rate-limit",
});

/** Provider to configure the rate limit check endpoint. */
export function RateLimitProvider({
  endpoint = "/api/rate-limit",
  children,
}: {
  endpoint?: string;
  children: ReactNode;
}) {
  return (
    <RateLimitContext.Provider value={{ endpoint }}>
      {children}
    </RateLimitContext.Provider>
  );
}

/**
 * Hook to check rate limit status for a given rule.
 * Calls the configured endpoint to verify server-side rate limits.
 *
 * @example
 * const { allowed, remaining, check } = useRateLimit("api-calls");
 */
export function useRateLimit(rule: string): RateLimitState {
  const { endpoint } = useContext(RateLimitContext);
  const [state, setState] = useState<Omit<RateLimitState, "check" | "loading">>(
    {
      allowed: true,
      remaining: Infinity,
      reset: 0,
    }
  );
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?rule=${encodeURIComponent(rule)}`);
      const data = await res.json();
      setState({
        allowed: data.allowed ?? res.ok,
        remaining: data.remaining ?? 0,
        reset: data.reset ?? 0,
      });
    } catch {
      // On network error, assume allowed to avoid blocking the UI
      setState({ allowed: true, remaining: 0, reset: 0 });
    } finally {
      setLoading(false);
    }
  }, [endpoint, rule]);

  // Check on mount
  useEffect(() => {
    void check();
  }, [check]);

  return { ...state, check, loading };
}

/**
 * Component that conditionally renders children based on rate limit status.
 * Shows the fallback when the user is rate-limited.
 *
 * @example
 * <RateLimited rule="api-calls" fallback={<p>Too many requests</p>}>
 *   <MyForm />
 * </RateLimited>
 */
export function RateLimited({
  rule,
  fallback,
  children,
}: {
  rule: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { allowed, loading } = useRateLimit(rule);

  if (loading) return null;
  if (!allowed) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
