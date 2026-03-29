import type { FilterTab } from "@/lib/types";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tools", label: "🛠 Tools" },
  { id: "links", label: "🔗 Links" },
  { id: "opportunities", label: "💼 Opportunities" },
  { id: "trending", label: "🔥 Trending" },
];

interface FilterTabsProps {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

export function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            active === id
              ? "bg-slate-600 text-slate-100"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
