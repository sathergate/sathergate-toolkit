import { InstallCommand } from "./install-command";

export function Hero() {
  return (
    <section className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-100 mb-4">
          Agent-native infrastructure{" "}
          <span className="text-cyan-400">for Next.js</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          8 packages. Zero dependencies. MCP in every one.
          <br />
          Authorization, feature flags, rate limiting, image processing, notifications,
          cron jobs, secrets, and search — all designed for AI coding agents.
        </p>
        <div className="max-w-md mx-auto">
          <InstallCommand command="npm install @sathergate/toolkit" />
        </div>
      </div>
    </section>
  );
}
