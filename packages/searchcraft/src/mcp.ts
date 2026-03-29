import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const CONFIG_FILENAME = "searchcraft.config.ts";

const CONFIG_TEMPLATE = `import { createSifter } from "searchcraft";

// Define your searchable schema
export const search = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: { weight: 1.5 },
  },
  documents: [],  // Load your documents here
});
`;

const CONFIG_TEMPLATE_PRESSROOM = `import { createSifter } from "searchcraft";

// Define your searchable schema
// Pressroom detected — content collections are auto-indexed when using
// the pressroom integration. See the pressroom docs for details.
export const search = createSifter({
  schema: {
    title: { weight: 2 },
    description: true,
    tags: { weight: 1.5 },
  },
  documents: [],  // Load your documents here
});
`;

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function hasDependency(
  pkg: Record<string, unknown>,
  name: string,
): boolean {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name]);
}

function detectPressroom(pkg: Record<string, unknown> | null): boolean {
  if (!pkg) return false;
  return hasDependency(pkg, "pressroom");
}

const server = new McpServer({
  name: "searchcraft",
  version: "0.1.0",
});

server.tool(
  "sifter_init",
  "Scaffolds a searchcraft.config.ts in a project directory with a starter search schema. Detects pressroom integration if present.",
  { projectDir: z.string().describe("Absolute path to the project directory") },
  async ({ projectDir }) => {
    const configPath = resolve(projectDir, CONFIG_FILENAME);

    if (existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${CONFIG_FILENAME} already exists at ${configPath}. Skipping.`,
          },
        ],
      };
    }

    const pkg = readPackageJson(projectDir);
    const warnings: string[] = [];

    if (pkg === null) {
      warnings.push(
        "No package.json found in the directory. Make sure you are in a project root.",
      );
    } else if (!hasDependency(pkg, "searchcraft")) {
      warnings.push(
        '"searchcraft" is not listed in your package.json dependencies. Run: npm install searchcraft',
      );
    }

    const hasPressroom = detectPressroom(pkg);
    const template = hasPressroom ? CONFIG_TEMPLATE_PRESSROOM : CONFIG_TEMPLATE;
    writeFileSync(configPath, template, "utf-8");

    const message = [
      `Created ${CONFIG_FILENAME} at ${configPath}`,
      ...(hasPressroom
        ? ["Pressroom detected — added auto-indexing note."]
        : []),
      ...warnings.map((w) => `Warning: ${w}`),
      "",
      "Next steps:",
      "  1. Add your documents to the config",
      "  2. Import { search } from './searchcraft.config' in your app",
      "  3. Call search.search('your search term') to search",
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: message }],
    };
  },
);

server.tool(
  "sifter_search",
  "Search documents using the searchcraft engine. This is a demo tool that works with sample data to demonstrate BM25 scoring, fuzzy matching, and result ranking.",
  {
    query: z.string().describe("The search query string"),
    limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    fuzzy: z.boolean().optional().describe("Enable fuzzy matching (default: false)"),
  },
  async ({ query, limit, fuzzy }) => {
    // Demo data to illustrate search capabilities
    const sampleDocs = [
      { id: "1", title: "Getting Started with React Hooks", description: "Learn useState, useEffect, and custom hooks", tags: ["react", "hooks", "tutorial"] },
      { id: "2", title: "Next.js App Router Guide", description: "Server components, layouts, and routing patterns", tags: ["nextjs", "routing", "server-components"] },
      { id: "3", title: "TypeScript Best Practices", description: "Type safety patterns for large codebases", tags: ["typescript", "types", "best-practices"] },
      { id: "4", title: "Building a Search Engine", description: "Full-text search with BM25 scoring and fuzzy matching", tags: ["search", "bm25", "algorithms"] },
      { id: "5", title: "React Server Components", description: "Understanding RSC architecture and data fetching", tags: ["react", "rsc", "server-components"] },
    ];

    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/);
    const maxResults = limit ?? 10;

    // Simple scoring: count term matches across fields
    const scored = sampleDocs.map((doc) => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const descLower = doc.description.toLowerCase();
      const tagsLower = doc.tags.join(" ").toLowerCase();

      for (const term of terms) {
        if (titleLower.includes(term)) score += 2; // title weight
        if (descLower.includes(term)) score += 1;
        if (tagsLower.includes(term)) score += 1.5; // tags weight

        // Fuzzy: check partial matches (simplified Levenshtein-like)
        if (fuzzy) {
          const words = `${titleLower} ${descLower} ${tagsLower}`.split(/\s+/);
          for (const word of words) {
            if (word.startsWith(term.slice(0, Math.max(3, term.length - 1)))) {
              score += 0.5;
            }
          }
        }
      }

      return { doc, score };
    });

    const results = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No results found for "${query}" in sample data.\n\nNote: This is a demo tool using sample documents. In production, searchcraft indexes your actual documents with BM25 scoring for much better results.\n\nTo use searchcraft in your project:\n  1. npm install searchcraft\n  2. npx searchcraft init\n  3. Add your documents to searchcraft.config.ts`,
          },
        ],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `${i + 1}. [score: ${r.score.toFixed(1)}] ${r.doc.title}\n   ${r.doc.description}\n   tags: ${r.doc.tags.join(", ")}`,
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Search results for "${query}"${fuzzy ? " (fuzzy)" : ""}:\n\n${formatted}\n\nNote: This is a demo using sample data. In production, searchcraft indexes your actual documents with BM25 scoring.`,
        },
      ],
    };
  },
);

export { server };
