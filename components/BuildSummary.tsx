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
    <div className="flex min-h-[320px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
        Build Summary
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            illegal
              ? "bg-red-500/20 text-red-300"
              : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {illegal ? "Invalid" : "Valid"}
        </span>
        <span className="text-sm text-zinc-300">
          Weapons: <strong>{weaponCount}</strong> / {weaponCap}
        </span>
        <span className="text-sm text-zinc-300">
          Placed: <strong>{placedCount}</strong>
        </span>
      </div>

      <section className="mb-4 rounded-lg border border-zinc-700 bg-zinc-950/70 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Selected Tile
        </h3>
        {selectedTile && selectedItem ? (
          <div className="mt-2 space-y-2 rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-sm font-semibold text-zinc-100">{selectedItem.name}</div>
            <div className="text-xs text-zinc-300">
              Category:{" "}
              <span className="font-medium capitalize">{selectedItem.category}</span>
            </div>
            <div className="text-xs text-zinc-300">
              Tags:{" "}
              {selectedItem.tags.length > 0 ? (
                <span className="font-medium">{selectedItem.tags.join(", ")}</span>
              ) : (
                <span className="font-medium text-zinc-500">None</span>
              )}
            </div>
            <div className="text-xs text-zinc-300">
              Rotation: <span className="font-medium">{selectedTile.rot}deg</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => rotateSelected("cw")}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Rotate CW
              </button>
              <button
                type="button"
                onClick={() => rotateSelected("ccw")}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Rotate CCW
              </button>
              <button
                type="button"
                onClick={() => {
                  removePlaced(selectedTile.instanceId);
                  select(null);
                }}
                className="rounded-md border border-red-500/50 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Issues
          </h3>
          <p className="sr-only" aria-live="polite">
            {errors.length} errors, {warnings.length} warnings
          </p>
          <details open className="rounded-md border border-red-500/35 bg-red-500/10 p-2">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-red-300">
              Errors ({errors.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
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
                        ? "cursor-pointer border-red-400/40 bg-red-500/15 text-red-100 hover:border-red-300/70 hover:bg-red-500/25"
                        : "cursor-default border-red-400/40 bg-red-500/15 text-red-100"
                    }`}
                  >
                    <span className="mr-1 font-bold">!</span>
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          <details open className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-amber-300">
              Warnings ({warnings.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
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
                        ? "cursor-pointer border-amber-400/40 bg-amber-500/15 text-amber-100 hover:border-amber-300/70 hover:bg-amber-500/25"
                        : "cursor-default border-amber-400/40 bg-amber-500/15 text-amber-100"
                    }`}
                  >
                    <span className="mr-1 font-bold">⚠</span>
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No issues.</p>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Click an issue with a tile to select it on the board.
      </p>
    </div>
  );
};
