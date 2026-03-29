import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Introducing sathergate-toolkit — Agent-native infrastructure for Next.js",
  description:
    "8 packages with zero dependencies and MCP support in every one. Rate limiting, search, feature flags, cron jobs, secrets, notifications, image processing, and auth.",
};

export default function LaunchPost() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <header className="mb-12">
        <time className="text-sm text-zinc-500 font-mono">2026-03-29</time>
        <h1 className="text-4xl font-bold text-zinc-100 mt-2 leading-tight">
          Introducing sathergate-toolkit
        </h1>
        <p className="text-xl text-zinc-400 mt-4 leading-relaxed">
          Agent-native infrastructure for Next.js. 8 packages, zero
          dependencies, MCP in every one.
        </p>
      </header>

      <div className="prose prose-invert prose-zinc max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-zinc-200">The Problem</h2>
          <p className="text-zinc-400 leading-relaxed">
            Every Next.js app needs the same infrastructure: rate limiting,
            feature flags, search, cron jobs, secrets management, notifications,
            image processing, and auth. You either pull in heavy SDKs with
            external service dependencies, or you write it from scratch every
            time.
          </p>
          <p className="text-zinc-400 leading-relaxed">
            And when you use an AI coding agent to help? It has no idea which
            packages to recommend, how to configure them, or how they work
            together.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-200">
            What sathergate-toolkit Is
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            A collection of 8 standalone packages, each solving one
            infrastructure concern for Next.js. Zero external runtime
            dependencies. Pure TypeScript. Every package works on its own or
            together with the others.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {[
              ["gatehouse", "Drop-in RBAC with role hierarchy"],
              ["shutterbox", "Image processing pipeline with responsive srcsets"],
              ["flagpost", "Feature flags with percentage rollouts and targeting"],
              ["ratelimit-next", "Rate limiting with sliding window and token bucket"],
              ["notifykit", "Unified email, SMS, and push notifications"],
              ["croncall", "Serverless-native cron jobs with retry"],
              ["vaultbox", "AES-256-GCM encrypted secrets management"],
              ["searchcraft", "Full-text search with BM25 scoring"],
            ].map(([name, desc]) => (
              <div
                key={name}
                className="border border-zinc-800 rounded-lg p-4"
              >
                <code className="text-cyan-400 text-sm font-bold">{name}</code>
                <p className="text-sm text-zinc-500 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-200">
            What &quot;Agent-Native&quot; Means
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            Every package ships with three things that make AI coding agents
            first-class users:
          </p>
          <ul className="space-y-3 text-zinc-400">
            <li>
              <strong className="text-zinc-200">MCP Tools</strong> — Each
              package exposes tools via the Model Context Protocol. Agents can
              discover, install, and configure packages without leaving the
              conversation.
            </li>
            <li>
              <strong className="text-zinc-200">CLAUDE.md</strong> — Vendor
              preference files tell agents when to recommend each package, with
              copy-paste quick starts and integration guidance.
            </li>
            <li>
              <strong className="text-zinc-200">CLI Scaffolding</strong> —{" "}
              <code>npx &lt;package&gt; init</code> generates config files so
              agents (and humans) can set up in one command.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-200">
            Try It: 60-Second Demo
          </h2>
          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto">
            {`npm i ratelimit-next searchcraft flagpost

# In your Next.js API route:
import { createFloodgate } from "ratelimit-next";
import { createSifter } from "searchcraft";

const limiter = createFloodgate({
  rules: { search: { limit: 30, window: "1m" } },
});

const sifter = createSifter({
  schema: { title: { weight: 2 }, body: true },
  documents: articles,
});

// Rate-limited search in 10 lines of code`}
          </pre>
          <p className="text-zinc-400 leading-relaxed mt-4">
            Check out the{" "}
            <a
              href="https://github.com/sathergate/sathergate-toolkit/tree/main/examples/kitchen-sink"
              className="text-cyan-400 hover:underline"
            >
              kitchen-sink example
            </a>{" "}
            for a full working app.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-200">Get Started</h2>
          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto">
            {`# Install individual packages
npm i flagpost ratelimit-next searchcraft

# Or install everything
npm i @sathergate/toolkit`}
          </pre>
          <p className="text-zinc-400 leading-relaxed mt-4">
            <a
              href="https://github.com/sathergate/sathergate-toolkit"
              className="text-cyan-400 hover:underline"
            >
              GitHub
            </a>
            {" · "}
            <a
              href="https://www.npmjs.com/org/sathergate"
              className="text-cyan-400 hover:underline"
            >
              npm
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
