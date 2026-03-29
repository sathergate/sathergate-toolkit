"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Flagpost,
  FlagDefinitions,
  FlagContext,
  FlagValue,
  ExtractFlags,
  ExtractFlagNames,
} from "./core/types.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FlagpostContextValue<T extends FlagDefinitions = FlagDefinitions> {
  flagpost: Flagpost<T>;
  flags: ExtractFlags<T> | null;
  isLoading: boolean;
}

const FlagpostContext = createContext<FlagpostContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface FlagpostProviderProps<T extends FlagDefinitions> {
  /** The flagpost instance created via createFlagpost(). */
  flagpost: Flagpost<T>;
  /** Optional async function returning evaluation context. Overrides the config-level resolver. */
  context?: () => FlagContext | Promise<FlagContext>;
  children: ReactNode;
}

/**
 * Provides evaluated flag values to the component tree.
 *
 * Evaluates all flags on mount (and whenever the context resolver changes)
 * and stores the result in state so descendant components can read flags
 * synchronously via hooks.
 */
export function FlagpostProvider<T extends FlagDefinitions>({
  flagpost,
  context: contextResolver,
  children,
}: FlagpostProviderProps<T>) {
  const [flags, setFlags] = useState<ExtractFlags<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolve = useCallback(async () => {
    setIsLoading(true);
    try {
      const ctx = contextResolver
        ? await contextResolver()
        : await flagpost.resolveContext();
      const evaluated = flagpost.evaluateAll(ctx);
      setFlags(evaluated);
    } finally {
      setIsLoading(false);
    }
  }, [flagpost, contextResolver]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return (
    <FlagpostContext.Provider
      value={{ flagpost: flagpost as Flagpost, flags, isLoading }}
    >
      {children}
    </FlagpostContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useFlagpostContext(): FlagpostContextValue {
  const ctx = useContext(FlagpostContext);
  if (!ctx) {
    throw new Error("useFlagpostContext must be used within a <FlagpostProvider>.");
  }
  return ctx;
}

/**
 * Returns the flagpost instance from the nearest provider.
 */
export function useFlagpost(): Flagpost {
  return useFlagpostContext().flagpost;
}

/**
 * Returns all evaluated flag values.
 */
export function useFlags<T extends FlagDefinitions = FlagDefinitions>(): {
  flags: ExtractFlags<T> | null;
  isLoading: boolean;
} {
  const { flags, isLoading } = useFlagpostContext();
  return { flags: flags as ExtractFlags<T> | null, isLoading };
}

/**
 * Returns the value of a single flag along with loading and enabled state.
 */
export function useFlag<V extends FlagValue = FlagValue>(
  name: string,
): { value: V | undefined; isEnabled: boolean; isLoading: boolean } {
  const { flags, isLoading } = useFlagpostContext();

  if (isLoading || !flags) {
    return { value: undefined, isEnabled: false, isLoading };
  }

  const value = (flags as Record<string, FlagValue>)[name] as V | undefined;
  return {
    value,
    isEnabled: value === true,
    isLoading: false,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export interface FlagProps {
  /** The flag name to check. */
  name: string;
  /** Content to render when the flag is enabled (truthy). */
  children: ReactNode;
  /** Content to render when the flag is disabled. */
  fallback?: ReactNode;
  /** Content to render while flags are loading. */
  loading?: ReactNode;
}

/**
 * Renders children only when the named flag evaluates to true.
 *
 * @example
 * ```tsx
 * <Flag name="newCheckout" fallback={<OldCheckout />}>
 *   <NewCheckout />
 * </Flag>
 * ```
 */
export function Flag({ name, children, fallback, loading }: FlagProps) {
  const { value, isEnabled, isLoading } = useFlag(name);

  if (isLoading) {
    return <>{loading ?? null}</>;
  }

  // For non-boolean flags, render children if value is truthy
  if (typeof value !== "boolean") {
    return <>{value ? children : (fallback ?? null)}</>;
  }

  return <>{isEnabled ? children : (fallback ?? null)}</>;
}

export interface FlagSwitchProps {
  /** The flag name to evaluate. */
  name: string;
  /** Map of flag values to components. */
  cases: Record<string, ReactNode>;
  /** Fallback if the evaluated value does not match any case. */
  fallback?: ReactNode;
  /** Content to render while flags are loading. */
  loading?: ReactNode;
}

/**
 * Renders the component matching the evaluated flag value.
 *
 * @example
 * ```tsx
 * <FlagSwitch
 *   name="heroVariant"
 *   cases={{
 *     control: <HeroA />,
 *     experiment: <HeroB />,
 *   }}
 *   fallback={<HeroA />}
 * />
 * ```
 */
export function FlagSwitch({
  name,
  cases,
  fallback,
  loading,
}: FlagSwitchProps) {
  const { value, isLoading } = useFlag(name);

  if (isLoading) {
    return <>{loading ?? null}</>;
  }

  const key = String(value);
  const matched = cases[key];

  return <>{matched !== undefined ? matched : (fallback ?? null)}</>;
}
