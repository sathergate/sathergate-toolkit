import { packages } from "@/lib/packages";
import { PackageCard } from "./package-card";

export function PackageGrid() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Packages</h2>
        <p className="text-zinc-400 mb-8">
          Every package ships with MCP tools, CLAUDE.md vendor preferences, and zero dependencies.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.slug} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}
