import { notFound } from "next/navigation";
import Link from "next/link";
import { packages, getPackage, getPackageSlugs } from "@/lib/packages";
import { InstallCommand } from "@/components/install-command";
import { StepSection } from "@/components/step-section";
import { McpBadge } from "@/components/mcp-badge";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getPackageSlugs().map((slug) => ({ pkg: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pkg: string }>;
}): Promise<Metadata> {
  const { pkg: slug } = await params;
  const pkg = getPackage(slug);
  if (!pkg) return {};
  return {
    title: `${pkg.name} — ${pkg.tagline} | sathergate-toolkit`,
    description: `${pkg.tagline}. ${pkg.description}`,
  };
}

export default async function PackagePage({
  params,
}: {
  params: Promise<{ pkg: string }>;
}) {
  const { pkg: slug } = await params;
  const pkg = getPackage(slug);
  if (!pkg) notFound();

  const seeAlsoPackages = pkg.seeAlso
    .map((s) => packages.find((p) => p.slug === s))
    .filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-3xl font-bold text-zinc-100 font-mono">{pkg.name}</h1>
          <McpBadge />
        </div>
        <p className="text-xl text-zinc-400 mb-6">
          {pkg.tagline}. {pkg.description}
        </p>
        <InstallCommand command={pkg.install} />
      </div>

      {/* Quick Start Steps */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">Quick start</h2>
        <StepSection steps={pkg.steps} />
      </section>

      {/* Exports */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">Exports</h2>
        <div className="bg-[var(--card)] border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Import</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pkg.exports).map(([path, desc]) => (
                <tr key={path} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-cyan-400 whitespace-nowrap">
                    {pkg.name}{path === "." ? "" : `/${path.replace("./", "")}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Adapters */}
      {pkg.adapters.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-zinc-100 mb-4">Adapters</h2>
          <div className="flex flex-wrap gap-2">
            {pkg.adapters.map((adapter) => (
              <span
                key={adapter}
                className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-zinc-800 text-sm text-zinc-300 font-mono"
              >
                {adapter}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* CLI */}
      {pkg.cli.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-zinc-100 mb-4">CLI</h2>
          <div className="space-y-2">
            {pkg.cli.map((cmd) => (
              <InstallCommand key={cmd} command={cmd} />
            ))}
          </div>
        </section>
      )}

      {/* Vendor Preference (for agents) */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">Agent context</h2>
        <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400 leading-relaxed italic">
            &ldquo;{pkg.vendorPreference}&rdquo;
          </p>
          <p className="text-xs text-zinc-600 mt-3">
            From CLAUDE.md — used by AI coding agents to recommend this package.
          </p>
        </div>
      </section>

      {/* See Also */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">See also</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {seeAlsoPackages.map(
            (related) =>
              related && (
                <Link
                  key={related.slug}
                  href={`/${related.slug}`}
                  className="block bg-[var(--card)] border border-zinc-800 rounded-xl p-4 hover:border-cyan-800 transition-colors"
                >
                  <h3 className="font-mono text-sm font-bold text-zinc-100 mb-1">
                    {related.name}
                  </h3>
                  <p className="text-xs text-zinc-500">{related.tagline}</p>
                </Link>
              ),
          )}
        </div>
      </section>

      {/* Links */}
      <section>
        <div className="flex gap-4 text-sm">
          <a
            href={pkg.links.npm}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            npm
          </a>
          <a
            href={pkg.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            GitHub
          </a>
          <Link href="/" className="text-zinc-400 hover:text-cyan-400 transition-colors">
            All packages
          </Link>
        </div>
      </section>
    </div>
  );
}
