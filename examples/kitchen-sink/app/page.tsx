"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { item: { id: string; title: string; body: string }; score: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&fuzzy=true`,
      );
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <h1>sathergate-toolkit Kitchen Sink</h1>
      <p style={{ color: "#666" }}>
        A demo showing <strong>searchcraft</strong> (search),{" "}
        <strong>ratelimit-next</strong> (rate limiting),{" "}
        <strong>flagpost</strong> (feature flags),{" "}
        <strong>croncall</strong> (cron jobs), and{" "}
        <strong>vaultbox</strong> (secrets) working together.
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Search (searchcraft + ratelimit-next)</h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          BM25-powered full-text search with rate limiting at 30 req/min.
        </p>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: cron, search, rate limiting..."
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "8px 20px",
              fontSize: 16,
              cursor: "pointer",
              borderRadius: 6,
              border: "1px solid #333",
              background: "#333",
              color: "#fff",
            }}
          >
            {loading ? "..." : "Search"}
          </button>
        </form>

        {results.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
            {results.map((r) => (
              <li
                key={r.item.id}
                style={{
                  padding: "12px 16px",
                  margin: "8px 0",
                  border: "1px solid #eee",
                  borderRadius: 8,
                }}
              >
                <strong>{r.item.title}</strong>
                <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
                  {r.item.body}
                </p>
                <span style={{ fontSize: 12, color: "#aaa" }}>
                  Score: {r.score.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Cron Jobs (croncall)</h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          Visit <code>/api/cron</code> to trigger due jobs and see the schedule.
        </p>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Feature Flags (flagpost)</h2>
        <p style={{ fontSize: 14, color: "#888" }}>
          Flags defined in <code>lib/flags.ts</code>: showBanner, darkMode (50%
          rollout), newSearch (beta-only).
        </p>
      </section>
    </main>
  );
}
