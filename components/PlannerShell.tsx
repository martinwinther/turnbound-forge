"use client";

import { Board } from "@/components/Board";
import { useBuildStore } from "@/store/useBuildStore";

const modeButtonBase =
  "rounded-md border px-4 py-2 text-sm font-semibold transition";

export const PlannerShell = () => {
  const mode = useBuildStore((state) => state.mode);
  const setMode = useBuildStore((state) => state.setMode);
  const resetUnlockedToStart = useBuildStore(
    (state) => state.resetUnlockedToStart,
  );

  const isBuildMode = mode === "build";
  const isUnlockMode = mode === "unlock";

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
          <aside className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
            Item Library (coming soon)
          </aside>
          <div className="flex justify-center">
            <Board />
          </div>
          <aside className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
            Summary (coming soon)
          </aside>
        </div>
      </div>
    </div>
  );
};
