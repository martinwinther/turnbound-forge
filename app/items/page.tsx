"use client";

import { useState } from "react";
import { ItemLibrary } from "@/components/ItemLibrary";
import { ShapePreview } from "@/components/ShapePreview";
import { itemsById } from "@/lib/data";

export default function ItemsPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = selectedItemId ? itemsById[selectedItemId] : null;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Items database
          </h1>
          <p className="mt-1 text-sm text-zinc-300">
            Browse all items. Click an item to see its details.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <section className="flex min-h-[400px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <ItemLibrary
              onPick={setSelectedItemId}
              selectedItemId={selectedItemId}
              mode="full"
            />
          </section>

          <section className="min-h-[200px]">
            {selectedItem ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
                <h2 className="text-lg font-semibold text-zinc-100">
                  {selectedItem.name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-300">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium capitalize">
                    {selectedItem.category}
                  </span>
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {selectedItem.rulesText && (
                  <p className="mt-3 text-sm text-zinc-300">
                    {selectedItem.rulesText}
                  </p>
                )}
                <div className="mt-4">
                  <span className="block text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Shape
                  </span>
                  <div className="mt-2">
                    <ShapePreview cells={selectedItem.shape.cells} size={14} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/70 text-sm text-zinc-400">
                Select an item to view details
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
