import type { SignalItem } from "@/lib/types";

const TYPE_STYLES = {
  tool: { badge: "bg-violet-900 text-violet-300", icon: "🛠" },
  link: { badge: "bg-green-900 text-green-300", icon: "🔗" },
  opportunity: { badge: "bg-red-900 text-red-300", icon: "💼" },
};

function timeAgo(iso: string): string {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface FeedItemProps {
  item: SignalItem;
  variant: "compact" | "card";
}

export function FeedItem({ item, variant }: FeedItemProps) {
  const { badge, icon } = TYPE_STYLES[item.type];
  const isTrending = item.trendingScore > 5;

  if (variant === "compact") {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
      >
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-slate-100 text-sm truncate">
              {item.title}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge}`}>
              {item.type}
            </span>
            {isTrending && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 shrink-0">
                🔥
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            ↑ {item.votes} · {item.comments} comments ·{" "}
            {item.source ?? item.type} · {timeAgo(item.submittedAt)}
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800 rounded-xl overflow-hidden hover:bg-slate-700 transition-colors"
    >
      <div className="p-4">
        <div className="flex justify-between items-start gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <span className="font-semibold text-slate-100">{item.title}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
              {item.type}
            </span>
            {isTrending && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">
                🔥 trending
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">
          {item.description}
        </p>
        {item.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.salary && (
          <div className="text-xs text-slate-500 mb-2">
            {item.location} · {item.salary}
          </div>
        )}
      </div>
      <div className="flex justify-between px-4 py-2 bg-slate-900 text-xs text-slate-600">
        <span>↑ {item.votes}</span>
        <span>💬 {item.comments}</span>
        <span>{item.source ?? item.type}</span>
        <span>{timeAgo(item.submittedAt)}</span>
      </div>
    </a>
  );
}
