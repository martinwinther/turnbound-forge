"use client";

import { useMemo, useState } from "react";

import { Board } from "@/components/Board";
import { BuildSummary } from "@/components/BuildSummary";
import { ItemLibrary } from "@/components/ItemLibrary";
import { items, itemsById, trinketsById } from "@/lib/data";
import { GRID_H, GRID_W, HERO_START } from "@/lib/grid";
import { validateBuild } from "@/lib/validate";
import { useBuildStore } from "@/store/useBuildStore";

const modeButtonBase =
  "rounded-md border px-4 py-2 text-sm font-semibold transition";

const itemsByIdAll = { ...itemsById, ...trinketsById };

export const PlannerShell = () => {
  const [pickedItemId, setPickedItemId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [devX, setDevX] = useState(HERO_START.x);
  const [devY, setDevY] = useState(HERO_START.y);

  const mode = useBuildStore((state) => state.mode);
  const unlocked = useBuildStore((state) => state.unlocked);
  const placed = useBuildStore((state) => state.placed);
  const trinkets = useBuildStore((state) => state.trinkets);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const setMode = useBuildStore((state) => state.setMode);
  const select = useBuildStore((state) => state.select);
  const resetUnlockedToStart = useBuildStore(
    (state) => state.resetUnlockedToStart,
  );
  const addPlaced = useBuildStore((state) => state.addPlaced);
  const removePlaced = useBuildStore((state) => state.removePlaced);
  const addTrinket = useBuildStore((state) => state.addTrinket);
  const rotateSelected = useBuildStore((state) => state.rotateSelected);

  const validation = useMemo(
    () =>
      validateBuild({
        state: { v: 1, unlocked, placed, trinkets },
        itemsById: itemsByIdAll,
        gridW: GRID_W,
        gridH: GRID_H,
      }),
    [unlocked, placed, trinkets],
  );

  const isBuildMode = mode === "build";
  const isUnlockMode = mode === "unlock";
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMode("build")}
              aria-pressed={isBuildMode}
              className={`${modeButtonBase} ${
                isBuildMode
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => setMode("unlock")}
              aria-pressed={isUnlockMode}
              className={`${modeButtonBase} ${
                isUnlockMode
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              Unlock
            </button>
          </div>
          <button
            type="button"
            onClick={resetUnlockedToStart}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
          >
            Reset start mask
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <aside className="flex min-h-[320px] flex-col rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">
              Item Library
            </h2>
            <ItemLibrary
              onPick={setPickedItemId}
              selectedItemId={pickedItemId}
              mode="full"
            />
            {isDevelopment ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Dev Tools
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <label htmlFor="dev-x" className="sr-only">
                      X
                    </label>
                    <input
                      id="dev-x"
                      type="number"
                      min={0}
                      max={GRID_W - 1}
                      value={devX}
                      onChange={(e) =>
                        setDevX(Number.parseInt(e.target.value, 10) || 0)
                      }
                      className="w-12 rounded border border-zinc-300 px-1.5 py-1 text-xs"
                    />
                    <label htmlFor="dev-y" className="sr-only">
                      Y
                    </label>
                    <input
                      id="dev-y"
                      type="number"
                      min={0}
                      max={GRID_H - 1}
                      value={devY}
                      onChange={(e) =>
                        setDevY(Number.parseInt(e.target.value, 10) || 0)
                      }
                      className="w-12 rounded border border-zinc-300 px-1.5 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        addPlaced(
                          pickedItemId ?? items[0]?.id ?? "",
                          devX,
                          devY,
                        )
                      }
                      className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                    >
                      Place at X,Y
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      addPlaced(
                        pickedItemId ?? items[0]?.id ?? "",
                        HERO_START.x + 1,
                        HERO_START.y,
                      )
                    }
                    className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                  >
                    Add Tile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedInstanceId) {
                        return;
                      }
                      removePlaced(selectedInstanceId);
                    }}
                    disabled={!selectedInstanceId}
                    className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateSelected("cw")}
                    disabled={!selectedInstanceId}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Rotate CW
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateSelected("ccw")}
                    disabled={!selectedInstanceId}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Rotate CCW
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addTrinket(0, 0, "trinket-armory-signet")
                    }
                    className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
                  >
                    Add weapon-cap trinket
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
          <div className="flex justify-center">
            <Board issues={validation.issues} />
          </div>
          <aside className="flex min-w-[280px] flex-col">
            <BuildSummary
              validation={validation}
              placedCount={placed.length}
              onSelectInstance={select}
            />
          </aside>
        </div>
      </div>
    </div>
  );
};
