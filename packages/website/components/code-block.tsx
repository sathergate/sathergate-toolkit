import { CopyButton } from "./copy-button";

export function CodeBlock({ code, file }: { code: string; file?: string }) {
  return (
    <div className="relative group">
      {file && (
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 border-b-0 rounded-t-lg px-4 py-2 text-xs text-zinc-500 font-mono">
          <span>{file}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className={file ? "!rounded-t-none !border-t-0" : ""}>
        <code>{code}</code>
      </pre>
      {!file && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={code} />
        </div>
      )}
    </div>
  );
}
