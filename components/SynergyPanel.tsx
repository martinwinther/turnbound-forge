import { useState } from "react";

import type { Item } from "@/lib/types";

type SynergySuggestion = {
  item: Item;
  overlap: number;
  shared: string[];
};

type SynergyPanelProps = {
  activeTags: string[];
  suggestions: SynergySuggestion[];
  includePlaced: boolean;
  onIncludePlacedChange: (include: boolean) => void;
  onPick: (itemId: string) => void;
  onFilterToSynergy?: () => void;
};

const MAX_SUGGESTIONS = 10;

export const SynergyPanel = ({
  activeTags,
  suggestions,
  includePlaced,
  onIncludePlacedChange,
  onPick,
  onFilterToSynergy,
}: SynergyPanelProps) => {
  const [minOverlap, setMinOverlap] = useState(1);

  const hasActiveTags = activeTags.length > 0;
  const filteredSuggestions = suggestions
    .filter((entry) => entry.overlap >= minOverlap)
    .slice(0, MAX_SUGGESTIONS);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
            Synergy
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Suggestions based on shared tags with your current build.
          </p>
        </div>
        <button
          type="button"
          onClick={onFilterToSynergy}
          disabled={!hasActiveTags}
          className="rounded-md border border-amber-400/70 bg-amber-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-950 shadow-[0_0_14px_rgba(251,191,36,0.45)] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-400 disabled:shadow-none"
        >
          Filter Library
        </button>
      </header>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Active tags</span>
          <span className="text-[11px] text-zinc-500">
            {activeTags.length} tag{activeTags.length === 1 ? "" : "s"}
          </span>
        </div>
        {hasActiveTags ? (
          <div className="flex flex-wrap gap-1.5">
            {activeTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Place tiles or equip trinkets to start building up synergy tags.
          </p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 text-amber-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
            checked={includePlaced}
            onChange={(event) => onIncludePlacedChange(event.target.checked)}
          />
          <span>Include already placed items</span>
        </label>
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span>Minimum overlap</span>
          <select
            value={minOverlap}
            onChange={(event) => setMinOverlap(Number(event.target.value))}
            className="rounded-md border border-zinc-700 bg-zinc-950/70 px-1.5 py-1 text-[11px] text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <option value={1}>1+</option>
            <option value={2}>2+</option>
            <option value={3}>3+</option>
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Suggestions</span>
          <span className="text-[11px] text-zinc-500">
            Showing {filteredSuggestions.length} of {suggestions.length}
          </span>
        </div>
        {filteredSuggestions.length === 0 ? (
          <p className="py-2 text-xs text-zinc-500">
            No items meet the current overlap threshold. Try lowering the minimum overlap or
            adding more tagged items to your build.
          </p>
        ) : (
          <ul className="space-y-1.5" role="list">
            {filteredSuggestions.map((entry) => {
              const sharedPreview = entry.shared.slice(0, 3);
              return (
                <li key={entry.item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(entry.item.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-left text-xs text-zinc-200 transition hover:border-amber-400/70 hover:bg-zinc-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-50">
                          {entry.item.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                          {entry.overlap} tag{entry.overlap === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-1.5 py-0.5">
                          {entry.item.category}
                        </span>
                        {sharedPreview.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-200"
                          >
                            {tag}
                          </span>
                        ))}
                        {entry.shared.length > sharedPreview.length ? (
                          <span className="text-[11px] text-zinc-500">
                            +{entry.shared.length - sharedPreview.length} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

