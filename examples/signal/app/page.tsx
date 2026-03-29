"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SEED_DATA } from "@/lib/data";
import { fp } from "@/lib/flags";
import { FeedItem } from "@/components/FeedItem";
import { FilterTabs } from "@/components/FilterTabs";
import { SubmitModal } from "@/components/SubmitModal";
import type { SignalItem, FilterTab } from "@/lib/types";

function getOrCreateUserId(): string {
  if (typeof sessionStorage === "undefined") return "user-demo";
  const stored = sessionStorage.getItem("signal-uid");
  if (stored) return stored;
  const uid = `user-${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem("signal-uid", uid);
  return uid;
}

export default function Home() {
  const [baseItems, setBaseItems] = useState<SignalItem[]>(SEED_DATA);
  const [searchResults, setSearchResults] = useState<SignalItem[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [variant, setVariant] = useState<"compact" | "card">("compact");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evaluate flag once on mount
  useEffect(() => {
    const userId = getOrCreateUserId();
    const flags = fp.evaluateAll({ userId });
    if (flags.new_feed_layout) setVariant("card");
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&fuzzy=true`
      );
      if (res.status === 429) {
        setSearchError("Too many requests — slow down");
        return;
      }
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setSearchError(null);
    } catch {
      setSearchError("Search failed");
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Derive displayed items: search results (or base) filtered by tab
  const displayItems = (searchResults ?? baseItems).filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "tools") return item.type === "tool";
    if (activeFilter === "links") return item.type === "link";
    if (activeFilter === "opportunities") return item.type === "opportunity";
    if (activeFilter === "trending") return item.trendingScore > 5;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="font-bold text-slate-100 text-xl tracking-tight">
          signal
        </h1>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools, articles, opportunities…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Submit
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4">
        <FilterTabs active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Error toast */}
      {searchError && (
        <p className="text-sm text-red-400 mb-3">{searchError}</p>
      )}

      {/* Feed */}
      <div className={variant === "card" ? "flex flex-col gap-3" : "flex flex-col gap-1.5"}>
        {displayItems.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">
            No results{query ? ` for "${query}"` : ""}
          </p>
        ) : (
          displayItems.map((item) => (
            <FeedItem key={item.id} item={item} variant={variant} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-700">
        🚩 new_feed_layout (50% rollout) · 🛡 Search: 60 req/min · Submit: 5 req/hr · ⏰ Trending: hourly cron
      </div>

      {/* Submit modal */}
      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSuccess={(item) => setBaseItems((prev) => [item, ...prev])}
        />
      )}
    </div>
  );
}
