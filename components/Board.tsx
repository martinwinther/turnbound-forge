"use client";

import { useEffect, useMemo, useRef } from "react";

import { itemsById } from "@/lib/data";
import { HERO_START, GRID_H, GRID_W, toIndex } from "@/lib/grid";
import { getOccupiedCells } from "@/lib/polyomino";
import { useBuildStore } from "@/store/useBuildStore";
import type { Cell } from "@/lib/polyomino";
import type { Rotation } from "@/lib/types";
import type { ValidationIssue } from "@/lib/validate";

const getCellLabel = (
  x: number,
  y: number,
  isHero: boolean,
  isUnlocked: boolean,
  topTile?: { itemName: string; isSelected: boolean },
) => {
  const parts = [`Cell ${x + 1},${y + 1}`];
  parts.push(isUnlocked ? "unlocked" : "locked");

  if (isHero) {
    parts.push("hero start");
  }

  if (topTile) {
    parts.push(`${topTile.itemName} tile`);
    if (topTile.isSelected) {
      parts.push("selected");
    }
  }

  return parts.join(", ");
};

const cellKey = (x: number, y: number) => `${x},${y}`;

type BoardProps = {
  issues?: ValidationIssue[];
  dragPreview?: {
    itemId: string;
    anchor: Cell | null;
    rot: Rotation;
    valid: boolean;
    cells: Cell[];
    tone: "valid" | "invalid" | "warning";
    issues?: string[];
  };
  onBoardRect?: (rect: DOMRect) => void;
  canDragPlaced?: boolean;
  hiddenInstanceId?: string | null;
  onPlacedDragStart?: (
    instanceId: string,
    grabbedCell: { x: number; y: number },
    event: PointerEvent,
  ) => void;
};

const DRAG_THRESHOLD_PX = 6;

export const Board = ({
  issues = [],
  dragPreview,
  onBoardRect,
  canDragPlaced = true,
  hiddenInstanceId = null,
  onPlacedDragStart,
}: BoardProps) => {
  const unlocked = useBuildStore((state) => state.unlocked);
  const placed = useBuildStore((state) => state.placed);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const mode = useBuildStore((state) => state.mode);
  const toggleUnlocked = useBuildStore((state) => state.toggleUnlocked);
  const select = useBuildStore((state) => state.select);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const suppressClickInstanceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onBoardRect || !gridRef.current) {
      return;
    }

    const measure = () => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      onBoardRect(rect);
    };

    measure();
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(gridRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [onBoardRect]);

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
      if (hiddenInstanceId && tile.instanceId === hiddenInstanceId) {
        continue;
      }

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
  }, [hiddenInstanceId, placed, selectedInstanceId]);

  const startPlacedDragWithThreshold = (
    instanceId: string,
    grabbedCell: { x: number; y: number },
    startPointerX: number,
    startPointerY: number,
    pointerId: number,
  ) => {
    let didStartDrag = false;

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      if (didStartDrag) {
        return;
      }

      const deltaX = event.clientX - startPointerX;
      const deltaY = event.clientY - startPointerY;
      const movedDistance = Math.hypot(deltaX, deltaY);
      if (movedDistance < DRAG_THRESHOLD_PX) {
        return;
      }

      didStartDrag = true;
      suppressClickInstanceIdRef.current = instanceId;
      onPlacedDragStart?.(instanceId, grabbedCell, event);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerDone);
      window.removeEventListener("pointercancel", handleWindowPointerDone);
    };

    const handleWindowPointerDone = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return;
      }
      cleanup();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerDone);
    window.addEventListener("pointercancel", handleWindowPointerDone);
  };

  const dragCellMap = useMemo(() => {
    const map = new Map<string, "valid" | "invalid" | "warning">();
    if (!dragPreview) {
      return map;
    }
    for (const cell of dragPreview.cells) {
      if (cell.x < 0 || cell.x >= GRID_W || cell.y < 0 || cell.y >= GRID_H) {
        continue;
      }
      map.set(cellKey(cell.x, cell.y), dragPreview.tone);
    }
    return map;
  }, [dragPreview]);

  return (
    <div className="inline-block rounded-xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.32)]">
      <div ref={gridRef} className="grid grid-cols-7 gap-1">
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
            const isSelectedAnchor = Boolean(topTile?.isSelected && topTile?.isAnchor);
            const issueLevel = cellIssueLevel.get(cellKey(x, y));
            const dragTone = dragCellMap.get(cellKey(x, y));

            const baseClasses =
              "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border text-[10px] font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900";
            const stateClasses = isUnlocked
              ? "border-zinc-700 bg-zinc-900/70 text-zinc-300"
              : "border-zinc-800 bg-zinc-950 text-zinc-500 bg-[linear-gradient(135deg,rgba(63,63,70,0.42)_25%,transparent_25%,transparent_50%,rgba(63,63,70,0.42)_50%,rgba(63,63,70,0.42)_75%,transparent_75%,transparent)] bg-[length:8px_8px]";
            const heroClasses = isHero
              ? "border-amber-400/80 shadow-[0_0_14px_rgba(251,146,60,0.45)]"
              : "";
            const selectedClasses = isSelected
              ? "border-sky-400 ring-2 ring-sky-400/80 ring-inset"
              : "";
            const issueClasses =
              issueLevel === "error"
                ? "ring-2 ring-red-500 ring-inset bg-red-500/20"
                : issueLevel === "warning"
                  ? "ring-2 ring-amber-400 ring-inset bg-amber-400/20"
                  : "";
            const dragClasses =
              dragTone === "invalid"
                ? "ring-2 ring-red-500 ring-inset bg-red-500/40"
                : dragTone === "warning"
                  ? "ring-2 ring-amber-500 ring-inset bg-amber-500/38"
                  : dragTone === "valid"
                    ? "ring-2 ring-emerald-500 ring-inset bg-emerald-500/35"
                    : "";
            const hoverClasses = isInteractive && !hasTile
              ? "hover:border-emerald-400 hover:bg-emerald-500/18"
              : hasTile
                ? "cursor-pointer hover:border-sky-400/70"
                : "cursor-pointer hover:border-zinc-500";

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={() => {
                  if (topTile?.instanceId === suppressClickInstanceIdRef.current) {
                    suppressClickInstanceIdRef.current = null;
                    return;
                  }

                  if (topTile) {
                    select(topTile.instanceId);
                    return;
                  }

                  select(null);
                  toggleUnlocked(index);
                }}
                onPointerDown={(event) => {
                  if (!topTile || !canDragPlaced || event.button !== 0) {
                    return;
                  }

                  startPlacedDragWithThreshold(
                    topTile.instanceId,
                    { x, y },
                    event.clientX,
                    event.clientY,
                    event.pointerId,
                  );
                }}
                aria-label={getCellLabel(x, y, isHero, isUnlocked, topTile)}
                aria-pressed={isInteractive ? isUnlocked : undefined}
                aria-disabled={!isInteractive}
                className={`${baseClasses} ${stateClasses} ${heroClasses} ${selectedClasses} ${issueClasses} ${dragClasses} ${hoverClasses}`}
              >
                {hasTile ? (
                  <span
                    className={`absolute inset-0 ${
                      isSelected ? "bg-sky-400/35" : "bg-sky-700/20"
                    }`}
                  />
                ) : null}
                {topTile?.isAnchor ? (
                  <span className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-zinc-950/80 px-1 py-0.5 text-[9px] font-semibold normal-case text-zinc-100">
                    {topTile.itemName}
                  </span>
                ) : null}
                {isSelectedAnchor ? (
                  <span
                    className="pointer-events-none absolute left-1 top-1 h-2.5 w-2.5 rounded-full border border-sky-300 bg-sky-100"
                    aria-hidden="true"
                  />
                ) : null}
                {isHero ? (
                  <span className="relative z-10 rounded-full border border-amber-300/70 bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-200">
                    HERO
                  </span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-3 text-xs text-zinc-400">
        Mode: <span className="font-semibold capitalize text-zinc-200">{mode}</span>
      </div>
    </div>
  );
};
