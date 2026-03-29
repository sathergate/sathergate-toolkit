import Link from "next/link";
import { packages } from "@/lib/packages";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-zinc-100 font-mono text-sm mb-3">sathergate-toolkit</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Agent-native infrastructure toolkit for Next.js.
              Every package ships with MCP tools.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Packages</h4>
            <ul className="space-y-1.5">
              {packages.map((pkg) => (
                <li key={pkg.slug}>
                  <Link
                    href={`/${pkg.slug}`}
                    className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors font-mono"
                  >
                    {pkg.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Links</h4>
            <ul className="space-y-1.5">
              <li>
                <a href="https://github.com/sathergate/sathergate-toolkit" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://www.npmjs.com/org/sathergate" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">
                  npm
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-zinc-900 text-xs text-zinc-600 text-center">
          MIT License
        </div>
      </div>
    </footer>
  );
}
