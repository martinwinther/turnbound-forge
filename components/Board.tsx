"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ItemTooltip } from "@/components/ItemTooltip";
import { itemsById } from "@/lib/data";
import { fromIndex, GRID_H, GRID_W, isHeroCell, toIndex } from "@/lib/grid";
import { getOccupiedCells } from "@/lib/polyomino";
import { useBuildStore } from "@/store/useBuildStore";
import type { Cell } from "@/lib/polyomino";
import type { Item, Rotation } from "@/lib/types";
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
    parts.push("hero tile");
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
  heroAnchor: { x: number; y: number };
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
  mode: "build" | "unlock";
  onPaintToggle?: (indices: number[], makeUnlocked: boolean) => void;
  onUnlockStatus?: (message: string) => void;
  hiddenInstanceId?: string | null;
  heroDragTone?: "valid" | "invalid" | null;
  onHeroDragStart?: (
    grabbedCell: { x: number; y: number },
    event: PointerEvent,
  ) => void;
  onPlacedDragStart?: (
    instanceId: string,
    grabbedCell: { x: number; y: number },
    event: PointerEvent,
  ) => void;
  onTileContextMenu?: (args: { instanceId: string; x: number; y: number }) => void;
};

const DRAG_THRESHOLD_PX = 6;

export const Board = ({
  heroAnchor,
  issues = [],
  dragPreview,
  onBoardRect,
  canDragPlaced = true,
  mode,
  onPaintToggle,
  onUnlockStatus,
  hiddenInstanceId = null,
  heroDragTone = null,
  onHeroDragStart,
  onPlacedDragStart,
  onTileContextMenu,
}: BoardProps) => {
  const unlocked = useBuildStore((state) => state.unlocked);
  const placed = useBuildStore((state) => state.placed);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const select = useBuildStore((state) => state.select);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const suppressClickInstanceIdRef = useRef<string | null>(null);
  const [paintPreview, setPaintPreview] = useState<{
    makeUnlocked: boolean;
    indices: Set<number>;
  } | null>(null);
  const [supportsHover, setSupportsHover] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
  const [hoveredAnchorRect, setHoveredAnchorRect] = useState<DOMRect | null>(null);
  const paintSessionRef = useRef<{
    pointerId: number;
    makeUnlocked: boolean;
    visitedIndices: Set<number>;
    appliedIndices: Set<number>;
    hasShownOccupiedLockMessage: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setSupportsHover(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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
      Array<{
        instanceId: string;
        itemId: string;
        itemName: string;
        isAnchor: boolean;
        isSelected: boolean;
      }>
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
          itemId: item.id,
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

  const startHeroDragWithThreshold = (
    grabbedCell: { x: number; y: number },
    startPointerX: number,
    startPointerY: number,
    pointerId: number,
  ) => {
    let didStartDrag = false;

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId || didStartDrag) {
        return;
      }

      const deltaX = event.clientX - startPointerX;
      const deltaY = event.clientY - startPointerY;
      const movedDistance = Math.hypot(deltaX, deltaY);
      if (movedDistance < DRAG_THRESHOLD_PX) {
        return;
      }

      didStartDrag = true;
      onHeroDragStart?.(grabbedCell, event);
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

  const resolveCellIndexFromPointer = useCallback((pointerX: number, pointerY: number) => {
    const hitElement = document.elementFromPoint(pointerX, pointerY);
    if (!(hitElement instanceof HTMLElement)) {
      return null;
    }

    const cellElement = hitElement.closest<HTMLButtonElement>("[data-cell-index]");
    if (!cellElement?.dataset.cellIndex) {
      return null;
    }

    const cellIndex = Number.parseInt(cellElement.dataset.cellIndex, 10);
    return Number.isNaN(cellIndex) ? null : cellIndex;
  }, []);

  const applyPaintAtIndex = useCallback(
    (index: number) => {
      const session = paintSessionRef.current;
      if (!session || session.visitedIndices.has(index)) {
        return;
      }

      session.visitedIndices.add(index);
      const { x, y } = fromIndex(index);
      if (isHeroCell(x, y, heroAnchor)) {
        return;
      }

      if (!session.makeUnlocked && occupiedByIndex.has(index)) {
        if (!session.hasShownOccupiedLockMessage) {
          onUnlockStatus?.("Can't lock occupied cells.");
          session.hasShownOccupiedLockMessage = true;
        }
        return;
      }

      session.appliedIndices.add(index);
      setPaintPreview((previous) => {
        if (!previous || previous.makeUnlocked !== session.makeUnlocked) {
          return previous;
        }

        const nextIndices = new Set(previous.indices);
        nextIndices.add(index);
        return { ...previous, indices: nextIndices };
      });
    },
    [heroAnchor, occupiedByIndex, onUnlockStatus],
  );

  const endPaintSession = useCallback(
    (pointerId: number) => {
      const session = paintSessionRef.current;
      if (!session || session.pointerId !== pointerId) {
        return;
      }

      if (gridRef.current?.hasPointerCapture(pointerId)) {
        gridRef.current.releasePointerCapture(pointerId);
      }

      const indices = Array.from(session.appliedIndices);
      if (indices.length > 0) {
        onPaintToggle?.(indices, session.makeUnlocked);
      }

      paintSessionRef.current = null;
      setPaintPreview(null);
    },
    [onPaintToggle],
  );

  useEffect(() => {
    if (mode !== "unlock") {
      const activeSession = paintSessionRef.current;
      if (
        activeSession &&
        gridRef.current?.hasPointerCapture(activeSession.pointerId)
      ) {
        gridRef.current.releasePointerCapture(activeSession.pointerId);
      }
      paintSessionRef.current = null;
    }
  }, [mode]);

  return (
    <div className="inline-block rounded-xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.32)]">
      <div
        ref={gridRef}
        className="relative grid grid-cols-7 gap-1"
        onPointerMove={(event) => {
          const session = paintSessionRef.current;
          if (!session || session.pointerId !== event.pointerId) {
            return;
          }

          const hitIndex = resolveCellIndexFromPointer(event.clientX, event.clientY);
          if (hitIndex == null) {
            return;
          }
          applyPaintAtIndex(hitIndex);
        }}
        onPointerUp={(event) => {
          endPaintSession(event.pointerId);
        }}
        onPointerCancel={(event) => {
          endPaintSession(event.pointerId);
        }}
      >
        {Array.from({ length: GRID_H }).map((_, y) =>
          Array.from({ length: GRID_W }).map((__, x) => {
            const index = toIndex(x, y);
            const activePaintPreview = mode === "unlock" ? paintPreview : null;
            const isPaintPreviewed = activePaintPreview?.indices.has(index) ?? false;
            const isUnlocked = isPaintPreviewed
              ? activePaintPreview?.makeUnlocked ?? unlocked.includes(index)
              : unlocked.includes(index);
            const isHero = isHeroCell(x, y, heroAnchor);
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
            const heroDragClasses =
              isHero && heroDragTone === "invalid"
                ? "ring-2 ring-red-500 ring-inset bg-red-500/30"
                : isHero && heroDragTone === "valid"
                  ? "ring-2 ring-emerald-500 ring-inset bg-emerald-500/25"
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

                  if (mode === "unlock") {
                    return;
                  }

                  if (isHero) {
                    select(null);
                    return;
                  }

                  if (topTile) {
                    select(topTile.instanceId);
                    return;
                  }

                  select(null);
                }}
                onMouseEnter={(event) => {
                  if (!supportsHover || !topTile) {
                    return;
                  }
                  const item = itemsById[topTile.itemId];
                  if (!item) {
                    return;
                  }
                  setHoveredItem(item);
                  setHoveredAnchorRect(event.currentTarget.getBoundingClientRect());
                }}
                onMouseLeave={() => {
                  if (!supportsHover) {
                    return;
                  }
                  setHoveredItem(null);
                  setHoveredAnchorRect(null);
                }}
                onContextMenu={(event) => {
                  if (!topTile || mode !== "build") {
                    return;
                  }
                  event.preventDefault();
                  select(topTile.instanceId);
                  onTileContextMenu?.({
                    instanceId: topTile.instanceId,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onPointerDown={(event) => {
                  if (mode === "unlock" && event.button === 0) {
                    if (isHero) {
                      return;
                    }

                    select(null);
                    const makeUnlocked = !isUnlocked;
                    paintSessionRef.current = {
                      pointerId: event.pointerId,
                      makeUnlocked,
                      visitedIndices: new Set<number>(),
                      appliedIndices: new Set<number>(),
                      hasShownOccupiedLockMessage: false,
                    };
                    setPaintPreview({ makeUnlocked, indices: new Set<number>() });
                    gridRef.current?.setPointerCapture(event.pointerId);
                    applyPaintAtIndex(index);
                    return;
                  }

                  if (mode === "build" && isHero && event.button === 0) {
                    startHeroDragWithThreshold(
                      {
                        x: x - heroAnchor.x,
                        y: y - heroAnchor.y,
                      },
                      event.clientX,
                      event.clientY,
                      event.pointerId,
                    );
                    return;
                  }

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
                data-cell-index={index}
                className={`${baseClasses} ${stateClasses} ${heroClasses} ${selectedClasses} ${issueClasses} ${dragClasses} ${heroDragClasses} ${hoverClasses}`}
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
                  <span
                    className="pointer-events-none absolute inset-0 z-0 bg-amber-500/10"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          }),
        )}
        <div
          className="pointer-events-none z-20 flex items-center justify-center"
          style={{
            gridColumn: `${heroAnchor.x + 1} / span 2`,
            gridRow: `${heroAnchor.y + 1} / span 2`,
          }}
          aria-hidden="true"
        >
          <span className="rounded-full border border-amber-300/70 bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
            HERO
          </span>
        </div>
      </div>
      {hoveredItem ? (
        <ItemTooltip
          item={hoveredItem}
          open
          anchorRect={hoveredAnchorRect}
        />
      ) : null}
      <div className="mt-3 text-xs text-zinc-400">
        Mode: <span className="font-semibold capitalize text-zinc-200">{mode}</span>
      </div>
    </div>
  );
};
