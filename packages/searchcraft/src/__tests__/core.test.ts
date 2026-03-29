import { describe, it, expect } from "vitest";
import { createSifter } from "../core/sifter.js";
import { tokenize, stem } from "../core/tokenizer.js";

describe("tokenizer", () => {
  describe("tokenize", () => {
    it("splits text into lowercase tokens", () => {
      const tokens = tokenize("Hello World");
      expect(tokens).toEqual(["hello", "world"]);
    });

    it("removes stopwords (the, is, a, etc.)", () => {
      const tokens = tokenize("the cat is a good pet");
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("is");
      expect(tokens).not.toContain("a");
      expect(tokens).toContain("cat");
      expect(tokens).toContain("good");
      expect(tokens).toContain("pet");
    });

    it("stems tokens", () => {
      const tokens = tokenize("running searching");
      expect(tokens).toContain("run");
      expect(tokens).toContain("search");
    });

    it("returns empty array for empty input", () => {
      expect(tokenize("")).toEqual([]);
    });

    it("returns empty array for only stopwords", () => {
      expect(tokenize("the is a")).toEqual([]);
    });
  });

  describe("stem", () => {
    it("reduces -ing words (running -> run)", () => {
      expect(stem("running")).toBe("run");
    });

    it("reduces -tion words (action -> act)", () => {
      expect(stem("action")).toBe("act");
    });

    it("reduces -ies words (puppies -> puppy)", () => {
      expect(stem("puppies")).toBe("puppy");
    });

    it("reduces -ed words (searched -> search)", () => {
      expect(stem("searched")).toBe("search");
    });

    it("reduces -ly words (quickly -> quick)", () => {
      expect(stem("quickly")).toBe("quick");
    });

    it("reduces -es words (boxes -> boxe)", () => {
      expect(stem("boxes")).toBe("boxe");
    });

    it("reduces -s words (cats -> cat)", () => {
      expect(stem("cats")).toBe("cat");
    });

    it("does not stem short words", () => {
      expect(stem("go")).toBe("go");
      expect(stem("an")).toBe("an");
    });
  });
});

describe("createSifter", () => {
  interface Doc {
    title: string;
    body: string;
  }

  const docs: Doc[] = [
    { title: "Introduction to TypeScript", body: "TypeScript is a typed superset of JavaScript." },
    { title: "Advanced React Patterns", body: "Learn about hooks, context, and suspense in React." },
    { title: "Node.js Performance", body: "Optimize your Node.js applications for speed." },
    { title: "TypeScript Generics", body: "Generics allow creating reusable typed components." },
  ];

  it("indexes documents and searches", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    const results = sifter.search("typescript");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item.title).toContain("TypeScript");
  });

  it("returns results sorted by BM25 score (descending)", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    const results = sifter.search("typescript");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it("field weights affect ranking", () => {
    const sifter = createSifter({
      schema: { title: { weight: 10 }, body: { weight: 1 } },
      documents: [
        { title: "React basics", body: "Learn about components." },
        { title: "Components guide", body: "React is a library for building UIs." },
      ],
    });

    const results = sifter.search("react");
    expect(results[0]!.item.title).toBe("React basics");
  });

  it("empty query returns empty array", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    expect(sifter.search("")).toEqual([]);
  });

  it("no matches returns empty array", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    expect(sifter.search("xyznonexistent")).toEqual([]);
  });

  it("add inserts a new document into the index", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: [...docs],
    });

    expect(sifter.size).toBe(4);
    sifter.add({ title: "GraphQL Guide", body: "Query language for APIs." });
    expect(sifter.size).toBe(5);

    const results = sifter.search("graphql");
    expect(results.length).toBe(1);
    expect(results[0]!.item.title).toBe("GraphQL Guide");
  });

  it("remove deletes documents from the index", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: [...docs],
    });

    sifter.remove((doc) => doc.title.includes("React"));
    expect(sifter.size).toBe(3);

    const results = sifter.search("react");
    const titles = results.map((r) => r.item.title);
    expect(titles).not.toContain("Advanced React Patterns");
  });

  it("fuzzy search finds close matches", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    // "typscript" is a typo for "typescript" (edit distance within 2)
    const results = sifter.search("typscript", { fuzzy: true });
    expect(results.length).toBeGreaterThan(0);
  });

  it("search results include match info", () => {
    const sifter = createSifter({
      schema: { title: true, body: true },
      documents: docs,
    });

    const results = sifter.search("typescript");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.matches.length).toBeGreaterThan(0);
    expect(results[0]!.matches[0]).toHaveProperty("field");
    expect(results[0]!.matches[0]).toHaveProperty("positions");
  });
});
