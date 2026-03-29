"use client";

import { useState } from "react";
import type { ItemType, SignalItem } from "@/lib/types";

interface SubmitModalProps {
  onClose: () => void;
  onSuccess: (item: SignalItem) => void;
}

export function SubmitModal({ onClose, onSuccess }: SubmitModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ItemType>("tool");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, type, description }),
      });

      if (res.status === 429) {
        const retrySeconds = Number(res.headers.get("Retry-After") ?? 3600);
        setRetryAfter(Math.ceil(retrySeconds / 60));
        return;
      }

      if (!res.ok) return;

      const item: SignalItem = await res.json();
      onSuccess(item);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500";

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="font-semibold text-slate-100 mb-4">Submit to Signal</h2>

        {retryAfter !== null ? (
          <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-center mb-4">
            <p className="text-red-400 font-medium text-sm">
              Submission limit reached
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Try again in{" "}
              <span className="text-slate-100 font-medium">
                {retryAfter} minute{retryAfter !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Title *
            </label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome tool"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              URL *
            </label>
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Type
            </label>
            <div className="flex gap-2">
              {(["tool", "link", "opportunity"] as ItemType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors capitalize ${
                    type === t
                      ? "bg-indigo-900 border-indigo-500 text-indigo-300"
                      : "border-slate-700 text-slate-500 hover:border-slate-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">
              Description
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short description"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || retryAfter !== null}
              className="flex-1 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-600 text-center mt-3">
          5 submissions per hour
        </p>
      </div>
    </div>
  );
}
