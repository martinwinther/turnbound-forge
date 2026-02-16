"use client";

import { useMemo, useState } from "react";
import { items } from "@/lib/data";
import type { Item, ItemCategory } from "@/lib/types";
import { ITEM_CATEGORIES } from "@/lib/types";
import { ShapePreview } from "@/components/ShapePreview";

const TAG_SNIPPET_COUNT = 3;

type ItemLibraryProps = {
  onPick?: (itemId: string) => void;
  selectedItemId?: string | null;
  mode?: "compact" | "full";
};

function getAllTags(itemList: Item[]): string[] {
  const set = new Set<string>();
  itemList.forEach((item) => item.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

function filterItems(
  itemList: Item[],
  search: string,
  category: ItemCategory | "all",
  selectedTags: Set<string>,
): Item[] {
  const searchLower = search.trim().toLowerCase();
  return itemList.filter((item) => {
    if (searchLower && !item.name.toLowerCase().includes(searchLower)) {
      return false;
    }
    if (category !== "all" && item.category !== category) {
      return false;
    }
    for (const tag of selectedTags) {
      if (!item.tags.includes(tag)) {
        return false;
      }
    }
    return true;
  });
}

export function ItemLibrary({
  onPick,
  selectedItemId = null,
  mode = "full",
}: ItemLibraryProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const availableTags = useMemo(() => getAllTags(items), []);
  const filteredItems = useMemo(
    () => filterItems(items, search, category, selectedTags),
    [search, category, selectedTags],
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const isCompact = mode === "compact";

  return (
    <div className="flex h-full flex-col gap-3">
      <input
        type="search"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400"
        aria-label="Search items by name"
      />

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">
          Category
        </label>
        <select
          value={category}
          onChange={(e) =>
            setCategory((e.target.value === "all" ? "all" : e.target.value) as ItemCategory | "all")
          }
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700"
          aria-label="Filter by category"
        >
          <option value="all">All</option>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {!isCompact && availableTags.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            Tags (match all)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    isSelected
                      ? "bg-zinc-800 text-white"
                      : "border border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                  aria-pressed={isSelected}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="space-y-1" role="list">
          {filteredItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            const tagSnippet = item.tags.slice(0, TAG_SNIPPET_COUNT);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick?.(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPick?.(item.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-100 font-medium text-zinc-900"
                      : "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <ShapePreview
                    cells={item.shape.cells}
                    size={isCompact ? 8 : 10}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                      <span>{item.category}</span>
                      {tagSnippet.length > 0 && (
                        <span className="truncate">
                          {tagSnippet.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {filteredItems.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-500">
            No items match the filters.
          </p>
        )}
      </div>
    </div>
  );
}
