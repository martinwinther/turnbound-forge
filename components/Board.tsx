"use client";

import { HERO_START, GRID_H, GRID_W, toIndex } from "@/lib/grid";
import { useBuildStore } from "@/store/useBuildStore";

const getCellLabel = (isHero: boolean, isUnlocked: boolean) => {
  if (isHero) {
    return "Hero start cell";
  }
  return isUnlocked ? "Unlocked cell" : "Locked cell";
};

export const Board = () => {
  const unlocked = useBuildStore((state) => state.unlocked);
  const mode = useBuildStore((state) => state.mode);
  const toggleUnlocked = useBuildStore((state) => state.toggleUnlocked);

  return (
    <div className="inline-block rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: GRID_H }).map((_, y) =>
          Array.from({ length: GRID_W }).map((__, x) => {
            const index = toIndex(x, y);
            const isUnlocked = unlocked.includes(index);
            const isHero = x === HERO_START.x && y === HERO_START.y;
            const isInteractive = mode === "unlock";

            const baseClasses =
              "relative flex h-11 w-11 items-center justify-center rounded-md border text-xs font-semibold uppercase transition";
            const stateClasses = isUnlocked
              ? "border-zinc-200 bg-emerald-50 text-emerald-900"
              : "border-zinc-300 bg-zinc-100 text-zinc-400";
            const heroClasses = isHero
              ? "border-indigo-400 bg-indigo-100 text-indigo-900"
              : "";
            const hoverClasses = isInteractive
              ? "hover:border-emerald-400 hover:bg-emerald-100"
              : "cursor-default";

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={() => toggleUnlocked(index)}
                aria-label={getCellLabel(isHero, isUnlocked)}
                aria-pressed={isInteractive ? isUnlocked : undefined}
                aria-disabled={!isInteractive}
                className={`${baseClasses} ${stateClasses} ${heroClasses} ${hoverClasses}`}
              >
                {isHero ? "HERO" : null}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-3 text-xs text-zinc-500">
        Mode: <span className="font-medium capitalize">{mode}</span>
      </div>
    </div>
  );
};
