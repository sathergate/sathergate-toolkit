"use client";

import Link from "next/link";
import { McpBadge } from "./mcp-badge";
import { CopyButton } from "./copy-button";
import type { PackageInfo } from "@/lib/packages";

const categoryColors: Record<string, string> = {
  authorization: "bg-purple-950 text-purple-400 border-purple-800",
  "image-processing": "bg-amber-950 text-amber-400 border-amber-800",
  "feature-flags": "bg-green-950 text-green-400 border-green-800",
  "rate-limiting": "bg-red-950 text-red-400 border-red-800",
  notifications: "bg-blue-950 text-blue-400 border-blue-800",
  "scheduled-tasks": "bg-orange-950 text-orange-400 border-orange-800",
  "secrets-management": "bg-yellow-950 text-yellow-400 border-yellow-800",
  search: "bg-teal-950 text-teal-400 border-teal-800",
};

export function PackageCard({ pkg }: { pkg: PackageInfo }) {
  const colorClass = categoryColors[pkg.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";

  return (
    <Link href={`/${pkg.slug}`} className="block group">
      <div className="h-full bg-[var(--card)] border border-zinc-800 rounded-xl p-5 hover:border-cyan-800 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-bold text-zinc-100 group-hover:text-cyan-400 transition-colors font-mono">
            {pkg.name}
          </h3>
          <McpBadge />
        </div>

        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
          {pkg.tagline}. {pkg.description.split(".")[0]}.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
            {pkg.category}
          </span>
        </div>

        <div
          className="flex items-center gap-2 bg-[var(--code-bg)] rounded-md px-3 py-2 font-mono text-xs"
          onClick={(e) => e.preventDefault()}
        >
          <span className="text-zinc-500 select-none">$</span>
          <span className="text-cyan-400 flex-1 truncate">{pkg.install}</span>
          <CopyButton text={pkg.install} />
        </div>
      </div>
    </Link>
  );
}
