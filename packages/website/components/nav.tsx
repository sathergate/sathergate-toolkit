import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-zinc-100 font-mono text-sm hover:text-cyan-400 transition-colors">
          sathergate-toolkit
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/#packages" className="text-zinc-400 hover:text-zinc-100 transition-colors">
            Packages
          </Link>
          <a
            href="https://github.com/sathergate/sathergate-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/org/sathergate"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            npm
          </a>
        </div>
      </div>
    </nav>
  );
}
