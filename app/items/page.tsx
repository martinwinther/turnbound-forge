"use client";

import { useState } from "react";
import { ItemLibrary } from "@/components/ItemLibrary";
import { ShapePreview } from "@/components/ShapePreview";
import { itemsById } from "@/lib/data";

export default function ItemsPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = selectedItemId ? itemsById[selectedItemId] : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">Items database</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Browse all items. Click an item to see its details.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <section className="flex min-h-[400px] flex-col rounded-xl border border-zinc-200 bg-white p-4">
            <ItemLibrary
              onPick={setSelectedItemId}
              selectedItemId={selectedItemId}
              mode="full"
            />
          </section>

          <section className="min-h-[200px]">
            {selectedItem ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {selectedItem.name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium">
                    {selectedItem.category}
                  </span>
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-zinc-200 px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {selectedItem.rulesText && (
                  <p className="mt-3 text-sm text-zinc-600">
                    {selectedItem.rulesText}
                  </p>
                )}
                <div className="mt-4">
                  <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Shape
                  </span>
                  <div className="mt-2">
                    <ShapePreview cells={selectedItem.shape.cells} size={14} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-500">
                Select an item to view details
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
