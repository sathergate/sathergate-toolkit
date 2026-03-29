import { CopyButton } from "./copy-button";

export function InstallCommand({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--code-bg)] border border-zinc-800 rounded-lg px-4 py-3 font-mono text-sm">
      <span className="text-zinc-500 select-none">$</span>
      <span className="text-cyan-400 flex-1">{command}</span>
      <CopyButton text={command} />
    </div>
  );
}
