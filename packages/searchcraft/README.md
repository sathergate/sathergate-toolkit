# searchcraft

Full-text search for Next.js. No external service.

Sifter is a zero-dependency, in-process full-text search library built for Next.js applications. It uses TF-IDF with BM25 scoring, supports fuzzy matching, and ships with React components and a Next.js Route Handler out of the box.

## Install

```bash
npm install searchcraft
```

## Quick Start

```ts
import { createSifter } from "searchcraft";

const sifter = createSifter({
  schema: {
    title: { weight: 2 },
    body: true,
    tags: true,
  },
  documents: [
    { title: "Getting Started", body: "Welcome to the docs.", tags: ["intro"] },
    { title: "API Reference", body: "Full API documentation.", tags: ["api"] },
    { title: "Deployment Guide", body: "Deploy to production.", tags: ["ops"] },
  ],
});

const results = sifter.search("api documentation");
// [{ item: { title: "API Reference", ... }, score: 1.234, matches: [...] }]
```

## Schema Definition

A schema tells Sifter which fields to index and how to weight them.

```ts
const schema = {
  // Full form: configure weight and searchability
  title: { weight: 3, searchable: true },

  // Shorthand: `true` means searchable with default weight (1)
  body: true,

  // Not searchable (won't be indexed)
  id: false,

  // Custom weight, default searchable
  tags: { weight: 1.5 },
};
```

| Option       | Type    | Default | Description                          |
| ------------ | ------- | ------- | ------------------------------------ |
| `weight`     | number  | 1       | Relative importance for scoring      |
| `searchable` | boolean | true    | Whether the field is indexed         |

## Search API

### Basic Search

```ts
const results = sifter.search("deploy production");
```

All query terms use AND semantics -- every term must appear in a document for it to match.

### Fuzzy Search

```ts
const results = sifter.search("deploymnt", { fuzzy: true });
// Matches "deployment" (edit distance <= 2)
```

### Options

```ts
sifter.search("query", {
  limit: 20,       // Max results (default: 10)
  offset: 0,       // Skip N results for pagination
  fuzzy: true,     // Levenshtein distance <= 2
  threshold: 0.5,  // Minimum score to include
});
```

### Mutating the Index

```ts
// Add a document
sifter.add({ title: "New Page", body: "Content here." });

// Remove documents matching a predicate
sifter.remove((doc) => doc.title === "Old Page");

// Force rebuild (e.g., after bulk mutations)
sifter.rebuild();

// Check document count
console.log(sifter.size);
```

### Search Result Shape

```ts
interface SearchResult<T> {
  item: T;              // The original document
  score: number;        // BM25 relevance score
  matches: MatchInfo[]; // Where terms matched
}

interface MatchInfo {
  field: string;                 // Which field matched
  positions: [number, number][]; // Token positions [start, end]
}
```

## React Components

```bash
import { SifterProvider, SearchBox, SearchResults, useSearch, useSifter } from "searchcraft/react";
```

### SifterProvider

Wrap your search UI in a provider:

```tsx
import { createSifter } from "searchcraft";
import { SifterProvider, SearchBox, SearchResults } from "searchcraft/react";

const sifter = createSifter({ schema, documents });

function App() {
  return (
    <SifterProvider sifter={sifter}>
      <SearchBox placeholder="Search docs..." debounce={300} />
      <SearchResults renderItem={(result, i) => (
        <div key={i}>
          <h3>{result.item.title}</h3>
          <p>Score: {result.score.toFixed(2)}</p>
        </div>
      )} />
    </SifterProvider>
  );
}
```

### SearchBox Props

| Prop            | Type                                      | Default       | Description                    |
| --------------- | ----------------------------------------- | ------------- | ------------------------------ |
| `placeholder`   | string                                    | `"Search..."` | Input placeholder text         |
| `onResults`     | `(results: SearchResult[]) => void`       | --            | Callback when results change   |
| `debounce`      | number                                    | `200`         | Debounce delay in ms           |
| `searchOptions` | `SearchOptions`                           | --            | Options passed to each query   |
| `className`     | string                                    | --            | CSS class for the input        |

### Hooks

```tsx
function MyComponent() {
  // Access the sifter instance directly
  const sifter = useSifter();

  // Search with state management
  const { results, isSearching, search } = useSearch("initial query");

  return (
    <button onClick={() => search("new query")}>
      Search ({results.length} results)
    </button>
  );
}
```

## Next.js API Route

Create a search endpoint with zero boilerplate:

```ts
// app/api/search/route.ts
import { createSearchHandler } from "searchcraft/next";
import { sifter } from "@/lib/search";

export const GET = createSearchHandler(sifter);
```

**Query parameters:**

| Param       | Type   | Default | Description              |
| ----------- | ------ | ------- | ------------------------ |
| `q`         | string | --      | Search query (required)  |
| `limit`     | number | 10      | Max results              |
| `offset`    | number | 0       | Skip N results           |
| `fuzzy`     | string | --      | `"true"` or `"1"`        |
| `threshold` | number | 0       | Minimum score            |

**Example request:**

```
GET /api/search?q=deploy+guide&limit=5&fuzzy=true
```

**Response:**

```json
{
  "results": [
    {
      "item": { "title": "Deployment Guide", "body": "Deploy to production." },
      "score": 1.847,
      "matches": [{ "field": "title", "positions": [[0, 1]] }]
    }
  ],
  "query": "deploy guide",
  "total": 1
}
```

## Performance

Sifter builds an in-memory inverted index. Guidance for index sizes:

| Documents | Fields | Approx. Memory | Index Build Time |
| --------- | ------ | --------------- | ---------------- |
| 1,000     | 3      | ~2 MB           | ~50ms            |
| 10,000    | 3      | ~20 MB          | ~500ms           |
| 100,000   | 3      | ~200 MB         | ~5s              |

For datasets beyond 100k documents, consider a dedicated search service. Sifter is designed for content sites, documentation, product catalogs, and similar use cases where the full dataset fits comfortably in memory.

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
