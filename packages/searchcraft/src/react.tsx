"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Sifter, SearchResult, SearchOptions } from "./core/types.js";

// ---- Context ----

interface SifterContextValue<T = unknown> {
  sifter: Sifter<T>;
  results: SearchResult<T>[];
  isSearching: boolean;
  search: (query: string, options?: SearchOptions) => void;
}

const SifterContext = createContext<SifterContextValue | null>(null);

// ---- Provider ----

export interface SifterProviderProps<T> {
  sifter: Sifter<T>;
  children: ReactNode;
}

/**
 * Provide a Sifter instance to descendant components.
 *
 * @example
 * ```tsx
 * <SifterProvider sifter={mySifter}>
 *   <SearchBox />
 *   <SearchResults renderItem={(r) => <div>{r.item.title}</div>} />
 * </SifterProvider>
 * ```
 */
export function SifterProvider<T>({
  sifter,
  children,
}: SifterProviderProps<T>) {
  const [results, setResults] = useState<SearchResult<T>[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchFn = useCallback(
    (query: string, options?: SearchOptions) => {
      setIsSearching(true);
      try {
        const r = sifter.search(query, options);
        setResults(r);
      } finally {
        setIsSearching(false);
      }
    },
    [sifter],
  );

  const value: SifterContextValue<T> = {
    sifter,
    results,
    isSearching,
    search: searchFn,
  };

  return (
    <SifterContext.Provider value={value as SifterContextValue}>
      {children}
    </SifterContext.Provider>
  );
}

// ---- Hooks ----

/**
 * Access the Sifter instance from context.
 * Must be used within a `<SifterProvider>`.
 */
export function useSifter<T = unknown>(): Sifter<T> {
  const ctx = useContext(SifterContext);
  if (!ctx) {
    throw new Error("useSifter must be used within a <SifterProvider>");
  }
  return ctx.sifter as Sifter<T>;
}

/**
 * Search hook with optional initial query.
 * Returns results, searching state, and a search function.
 */
export function useSearch<T = unknown>(initialQuery?: string) {
  const ctx = useContext(SifterContext);
  if (!ctx) {
    throw new Error("useSearch must be used within a <SifterProvider>");
  }

  const { sifter, results, isSearching, search } =
    ctx as SifterContextValue<T>;

  // Run initial query on mount
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && initialQuery) {
      search(initialQuery);
      didInit.current = true;
    }
  }, [initialQuery, search]);

  return {
    results,
    isSearching,
    search,
    sifter,
  };
}

// ---- Components ----

export interface SearchBoxProps {
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Callback fired when results change. */
  onResults?: (results: SearchResult<unknown>[]) => void;
  /** Debounce delay in milliseconds. Default: 200 */
  debounce?: number;
  /** Search options passed to each query. */
  searchOptions?: SearchOptions;
  /** Additional className for the input element. */
  className?: string;
}

/**
 * A controlled search input with debounced querying.
 * Must be used within a `<SifterProvider>`.
 */
export function SearchBox({
  placeholder = "Search...",
  onResults,
  debounce = 200,
  searchOptions,
  className,
}: SearchBoxProps) {
  const ctx = useContext(SifterContext);
  if (!ctx) {
    throw new Error("SearchBox must be used within a <SifterProvider>");
  }

  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setValue(query);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        ctx.search(query, searchOptions);
      }, debounce);
    },
    [ctx, debounce, searchOptions],
  );

  // Fire onResults callback when results change
  const prevResults = useRef(ctx.results);
  useEffect(() => {
    if (prevResults.current !== ctx.results) {
      prevResults.current = ctx.results;
      onResultsRef.current?.(ctx.results);
    }
  }, [ctx.results]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <input
      type="search"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      aria-label={placeholder}
    />
  );
}

export interface SearchResultsProps<T> {
  /** Render function for each search result. */
  renderItem: (result: SearchResult<T>, index: number) => ReactNode;
  /** Optional className for the results container. */
  className?: string;
}

/**
 * Render search results from the nearest SifterProvider.
 * Must be used within a `<SifterProvider>`.
 */
export function SearchResults<T = unknown>({
  renderItem,
  className,
}: SearchResultsProps<T>) {
  const ctx = useContext(SifterContext);
  if (!ctx) {
    throw new Error("SearchResults must be used within a <SifterProvider>");
  }

  const results = ctx.results as SearchResult<T>[];

  return (
    <div className={className} role="list">
      {results.map((result, i) => (
        <div key={i} role="listitem">
          {renderItem(result, i)}
        </div>
      ))}
    </div>
  );
}
