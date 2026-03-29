"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-cyan-400 hover:border-cyan-800 transition-colors cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
