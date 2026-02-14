"use client";

import { useMemo } from "react";

import { itemsById } from "@/lib/data";
import { HERO_START, GRID_H, GRID_W, toIndex } from "@/lib/grid";
import { getOccupiedCells } from "@/lib/polyomino";
import { useBuildStore } from "@/store/useBuildStore";
import type { ValidationIssue } from "@/lib/validate";

const getCellLabel = (isHero: boolean, isUnlocked: boolean) => {
  if (isHero) {
    return "Hero start cell";
  }
  return isUnlocked ? "Unlocked cell" : "Locked cell";
};

const cellKey = (x: number, y: number) => `${x},${y}`;

type BoardProps = {
  issues?: ValidationIssue[];
};

export const Board = ({ issues = [] }: BoardProps) => {
  const unlocked = useBuildStore((state) => state.unlocked);
  const placed = useBuildStore((state) => state.placed);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const mode = useBuildStore((state) => state.mode);
  const toggleUnlocked = useBuildStore((state) => state.toggleUnlocked);
  const select = useBuildStore((state) => state.select);

  const cellIssueLevel = useMemo(() => {
    const map = new Map<string, "error" | "warning">();
    for (const issue of issues) {
      if (!issue.cells?.length) continue;
      const level = issue.level;
      for (const cell of issue.cells) {
        const key = cellKey(cell.x, cell.y);
        if (level === "error") {
          map.set(key, "error");
        } else if (!map.has(key)) {
          map.set(key, "warning");
        }
      }
    }
    return map;
  }, [issues]);

  const occupiedByIndex = useMemo(() => {
    const byIndex = new Map<
      number,
      Array<{ instanceId: string; itemName: string; isAnchor: boolean; isSelected: boolean }>
    >();

    for (const tile of placed) {
      const item = itemsById[tile.itemId];
      if (!item) {
        console.warn(`[Board] Missing item for placed tile: ${tile.itemId}`);
        continue;
      }

      const occupiedCells = getOccupiedCells({
        anchor: { x: tile.x, y: tile.y },
        shapeCells: item.shape.cells,
        pivot: item.shape.pivot,
        rot: tile.rot,
      });

      const hasOutOfBounds = occupiedCells.some(
        (cell) => cell.x < 0 || cell.x >= GRID_W || cell.y < 0 || cell.y >= GRID_H,
      );
      if (hasOutOfBounds) {
        console.warn(`[Board] Tile out of bounds: ${tile.instanceId} (${tile.itemId})`);
      }

      for (const cell of occupiedCells) {
        if (cell.x < 0 || cell.x >= GRID_W || cell.y < 0 || cell.y >= GRID_H) {
          continue;
        }

        const index = toIndex(cell.x, cell.y);
        const entry = {
          instanceId: tile.instanceId,
          itemName: item.name || item.id,
          isAnchor: cell.x === tile.x && cell.y === tile.y,
          isSelected: tile.instanceId === selectedInstanceId,
        };
        byIndex.set(index, [...(byIndex.get(index) ?? []), entry]);
      }
    }

    return byIndex;
  }, [placed, selectedInstanceId]);

  return (
    <div className="inline-block rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: GRID_H }).map((_, y) =>
          Array.from({ length: GRID_W }).map((__, x) => {
            const index = toIndex(x, y);
            const isUnlocked = unlocked.includes(index);
            const isHero = x === HERO_START.x && y === HERO_START.y;
            const isInteractive = mode === "unlock";
            const occupiedEntries = occupiedByIndex.get(index) ?? [];
            const topTile = occupiedEntries[occupiedEntries.length - 1];
            const hasTile = Boolean(topTile);
            const isSelected = Boolean(topTile?.isSelected);
            const issueLevel = cellIssueLevel.get(cellKey(x, y));

            const baseClasses =
              "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border text-xs font-semibold uppercase transition";
            const stateClasses = isUnlocked
              ? "border-zinc-200 bg-emerald-50 text-emerald-900"
              : "border-zinc-300 bg-zinc-100 text-zinc-400";
            const heroClasses = isHero
              ? "border-indigo-400 bg-indigo-100 text-indigo-900"
              : "";
            const selectedClasses = isSelected ? "border-2 border-sky-600" : "";
            const issueClasses =
              issueLevel === "error"
                ? "ring-2 ring-red-500 ring-inset bg-red-100/80"
                : issueLevel === "warning"
                  ? "ring-2 ring-amber-400 ring-inset bg-amber-50/80"
                  : "";
            const hoverClasses = isInteractive && !hasTile
              ? "hover:border-emerald-400 hover:bg-emerald-100"
              : "cursor-pointer";

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={() => {
                  if (topTile) {
                    select(topTile.instanceId);
                    return;
                  }

                  toggleUnlocked(index);
                }}
                aria-label={getCellLabel(isHero, isUnlocked)}
                aria-pressed={isInteractive ? isUnlocked : undefined}
                aria-disabled={!isInteractive}
                className={`${baseClasses} ${stateClasses} ${heroClasses} ${selectedClasses} ${issueClasses} ${hoverClasses}`}
              >
                {hasTile ? (
                  <span
                    className={`absolute inset-0 ${
                      isSelected ? "bg-sky-300/50" : "bg-sky-200/40"
                    }`}
                  />
                ) : null}
                {topTile?.isAnchor ? (
                  <span className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-zinc-900/70 px-1 py-0.5 text-[9px] font-semibold normal-case text-white">
                    {topTile.itemName}
                  </span>
                ) : null}
                {isHero ? (
                  <span className="relative z-10 rounded bg-indigo-700 px-1 py-0.5 text-[9px] text-white">
                    HERO
                  </span>
                ) : null}
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
