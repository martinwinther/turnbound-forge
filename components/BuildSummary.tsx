"use client";

import { itemsById } from "@/lib/data";
import type { ValidationResult } from "@/lib/validate";
import { useBuildStore } from "@/store/useBuildStore";

type BuildSummaryProps = {
  validation: ValidationResult;
  placedCount: number;
  onSelectInstance: (instanceId: string) => void;
};

export const BuildSummary = ({
  validation,
  placedCount,
  onSelectInstance,
}: BuildSummaryProps) => {
  const { issues, illegal, weaponCap, weaponCount } = validation;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const placed = useBuildStore((state) => state.placed);
  const rotateSelected = useBuildStore((state) => state.rotateSelected);
  const removePlaced = useBuildStore((state) => state.removePlaced);
  const select = useBuildStore((state) => state.select);

  const selectedTile = selectedInstanceId
    ? placed.find((tile) => tile.instanceId === selectedInstanceId) ?? null
    : null;
  const selectedItem = selectedTile ? itemsById[selectedTile.itemId] : null;

  return (
    <div className="flex min-h-[320px] flex-col rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800">Build Summary</h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            illegal
              ? "bg-red-100 text-red-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {illegal ? "Invalid" : "Valid"}
        </span>
        <span className="text-sm text-zinc-600">
          Weapons: <strong>{weaponCount}</strong> / {weaponCap}
        </span>
        <span className="text-sm text-zinc-600">
          Placed: <strong>{placedCount}</strong>
        </span>
      </div>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Selected Tile
        </h3>
        {selectedTile && selectedItem ? (
          <div className="mt-2 space-y-2">
            <div className="text-sm font-semibold text-zinc-900">{selectedItem.name}</div>
            <div className="text-xs text-zinc-600">
              Category:{" "}
              <span className="font-medium capitalize">{selectedItem.category}</span>
            </div>
            <div className="text-xs text-zinc-600">
              Tags:{" "}
              {selectedItem.tags.length > 0 ? (
                <span className="font-medium">{selectedItem.tags.join(", ")}</span>
              ) : (
                <span className="font-medium text-zinc-500">None</span>
              )}
            </div>
            <div className="text-xs text-zinc-600">
              Rotation: <span className="font-medium">{selectedTile.rot}deg</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => rotateSelected("cw")}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400"
              >
                Rotate CW
              </button>
              <button
                type="button"
                onClick={() => rotateSelected("ccw")}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400"
              >
                Rotate CCW
              </button>
              <button
                type="button"
                onClick={() => {
                  removePlaced(selectedTile.instanceId);
                  select(null);
                }}
                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Select a tile on the board.</p>
        )}
      </section>

      {issues.length > 0 ? (
        <div className="flex flex-1 flex-col gap-2 overflow-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Issues
          </h3>
          <p className="sr-only" aria-live="polite">
            {errors.length} errors, {warnings.length} warnings
          </p>
          <ul className="space-y-1.5">
            {errors.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() =>
                    issue.instanceId
                      ? onSelectInstance(issue.instanceId)
                      : undefined
                  }
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    issue.instanceId
                      ? "cursor-pointer border-red-200 bg-red-50 text-red-900 hover:border-red-300 hover:bg-red-100"
                      : "cursor-default border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  <span className="font-medium">Error:</span> {issue.message}
                </button>
              </li>
            ))}
            {warnings.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() =>
                    issue.instanceId
                      ? onSelectInstance(issue.instanceId)
                      : undefined
                  }
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    issue.instanceId
                      ? "cursor-pointer border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100"
                      : "cursor-default border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <span className="font-medium">Warning:</span> {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No issues.</p>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Click an issue with a tile to select it on the board.
      </p>
    </div>
  );
};
