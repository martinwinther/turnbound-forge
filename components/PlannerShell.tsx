"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "@/components/Board";
import { BuildSummary } from "@/components/BuildSummary";
import { ItemLibrary } from "@/components/ItemLibrary";
import { TrinketSlots } from "@/components/TrinketSlots";
import { items, itemsById, trinkets as allTrinkets, trinketsById } from "@/lib/data";
import { GRID_H, GRID_W, HERO_START, inBounds, toIndex } from "@/lib/grid";
import type { Cell } from "@/lib/polyomino";
import { getOccupiedCells } from "@/lib/polyomino";
import { BUILD_PARAM, decodeBuildFromString, encodeBuildToString } from "@/lib/share";
import { useDragSession } from "@/lib/useDragSession";
import { validateBuild } from "@/lib/validate";
import { useBuildStore } from "@/store/useBuildStore";

const modeButtonBase =
  "rounded-md border px-4 py-2 text-sm font-semibold transition";

const itemsByIdAll = { ...itemsById, ...trinketsById };
const interactiveTextSelector =
  "input, textarea, select, [contenteditable='true'], [role='textbox']";
const DEFAULT_POINTER = { x: 0, y: 0 };

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest(interactiveTextSelector));
};

export const PlannerShell = () => {
  const [pickedItemId, setPickedItemId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [devX, setDevX] = useState(HERO_START.x);
  const [devY, setDevY] = useState(HERO_START.y);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const didLoadFromUrlRef = useRef(false);

  const mode = useBuildStore((state) => state.mode);
  const unlocked = useBuildStore((state) => state.unlocked);
  const placed = useBuildStore((state) => state.placed);
  const trinkets = useBuildStore((state) => state.trinkets);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const setMode = useBuildStore((state) => state.setMode);
  const loadBuildState = useBuildStore((state) => state.loadBuildState);
  const getBuildState = useBuildStore((state) => state.getBuildState);
  const select = useBuildStore((state) => state.select);
  const resetUnlockedToStart = useBuildStore(
    (state) => state.resetUnlockedToStart,
  );
  const addPlaced = useBuildStore((state) => state.addPlaced);
  const removePlaced = useBuildStore((state) => state.removePlaced);
  const setTrinket = useBuildStore((state) => state.setTrinket);
  const setFullTrinket = useBuildStore((state) => state.setFullTrinket);
  const removeTrinket = useBuildStore((state) => state.removeTrinket);
  const rotateSelected = useBuildStore((state) => state.rotateSelected);
  const setPlacedPosition = useBuildStore((state) => state.setPlacedPosition);
  const setPlacedRotation = useBuildStore((state) => state.setPlacedRotation);
  const dragPreviewRef = useRef<{
    anchor: Cell | null;
    valid: boolean;
  } | null>(null);

  const {
    isDragging,
    dragKind,
    dragItemId,
    dragInstanceId,
    pointer,
    anchor,
    rot,
    startLibraryDrag,
    startPlacedDrag,
    rotateDrag,
    setAnchor,
  } = useDragSession({
    resolvePlacedDrag: (instanceId) => {
      const tile = placed.find((entry) => entry.instanceId === instanceId);
      if (!tile) {
        return null;
      }
      return {
        itemId: tile.itemId,
        origin: {
          x: tile.x,
          y: tile.y,
          rot: tile.rot,
        },
      };
    },
    onPointerUp: (sessionState) => {
      const preview = dragPreviewRef.current;
      if (!preview || !preview.anchor || !preview.valid) {
        return;
      }

      if (sessionState.dragKind === "library") {
        if (!sessionState.dragItemId) {
          return;
        }
        addPlaced(
          sessionState.dragItemId,
          preview.anchor.x,
          preview.anchor.y,
          sessionState.rot,
        );
        return;
      }

      if (sessionState.dragKind === "placed" && sessionState.dragInstanceId) {
        const { dragInstanceId: instanceId } = sessionState;
        setPlacedPosition(instanceId, preview.anchor.x, preview.anchor.y);
        setPlacedRotation(instanceId, sessionState.rot);
        select(instanceId);
      }
    },
  });

  const draggedPlacedInstanceId =
    isDragging && dragKind === "placed" ? dragInstanceId : null;

  const placedCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const tile of placed) {
      if (draggedPlacedInstanceId && tile.instanceId === draggedPlacedInstanceId) {
        continue;
      }

      const item = itemsById[tile.itemId];
      if (!item) {
        continue;
      }
      const cells = getOccupiedCells({
        anchor: { x: tile.x, y: tile.y },
        shapeCells: item.shape.cells,
        pivot: item.shape.pivot,
        rot: tile.rot,
      });
      for (const cell of cells) {
        if (!inBounds(cell.x, cell.y)) {
          continue;
        }
        set.add(`${cell.x},${cell.y}`);
      }
    }
    return set;
  }, [draggedPlacedInstanceId, placed]);

  const dragItem = dragItemId ? itemsById[dragItemId] : null;

  const dragPreview = useMemo(() => {
    if (!dragItemId || !dragItem) {
      return null;
    }

    const cells: Cell[] =
      anchor == null
        ? []
        : getOccupiedCells({
            anchor,
            shapeCells: dragItem.shape.cells,
            pivot: dragItem.shape.pivot,
            rot,
          });

    const hasOutOfBounds = cells.some((cell) => !inBounds(cell.x, cell.y));
    const hasOverlap = cells.some(
      (cell) => inBounds(cell.x, cell.y) && placedCellSet.has(`${cell.x},${cell.y}`),
    );
    const lockedCellCount = cells.filter(
      (cell) => inBounds(cell.x, cell.y) && !unlocked.includes(toIndex(cell.x, cell.y)),
    ).length;
    const valid = anchor != null && !hasOutOfBounds && !hasOverlap;

    const issues: string[] = [];
    if (anchor == null) {
      issues.push("outside-board");
    }
    if (hasOutOfBounds) {
      issues.push("out-of-bounds");
    }
    if (hasOverlap) {
      issues.push("overlap");
    }
    if (lockedCellCount > 0) {
      issues.push("locked-cells-warning");
    }

    const tone: "valid" | "invalid" | "warning" = !valid
      ? "invalid"
      : lockedCellCount > 0
        ? "warning"
        : "valid";

    return {
      itemId: dragItemId,
      anchor,
      rot,
      cells,
      valid,
      tone,
      issues,
    };
  }, [anchor, dragItem, dragItemId, placedCellSet, rot, unlocked]);

  useEffect(() => {
    dragPreviewRef.current = dragPreview
      ? { anchor: dragPreview.anchor, valid: dragPreview.valid }
      : null;
  }, [dragPreview]);

  useEffect(() => {
    if (!isDragging) {
      setAnchor(null);
      return;
    }

    if (!boardRect) {
      setAnchor(null);
      return;
    }

    const pointerX = pointer?.x ?? DEFAULT_POINTER.x;
    const pointerY = pointer?.y ?? DEFAULT_POINTER.y;
    const cellSize = boardRect.width / GRID_W;
    const relativeX = pointerX - boardRect.left;
    const relativeY = pointerY - boardRect.top;
    const isOutside =
      relativeX < 0 ||
      relativeY < 0 ||
      relativeX >= boardRect.width ||
      relativeY >= boardRect.height;

    if (isOutside) {
      setAnchor(null);
      return;
    }

    const nextAnchor = {
      x: Math.floor(relativeX / cellSize),
      y: Math.floor(relativeY / cellSize),
    };
    setAnchor(nextAnchor);
  }, [boardRect, isDragging, pointer, setAnchor]);

  const showLinkFeedback = (message: string) => {
    setLinkFeedback(message);
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setLinkFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 1500);
  };

  const handleCopyShareLink = async () => {
    try {
      const state = getBuildState();
      const encoded = encodeBuildToString(state);
      const url = new URL(window.location.href);
      url.searchParams.set(BUILD_PARAM, encoded);
      const nextUrl = url.toString();

      await navigator.clipboard.writeText(nextUrl);
      window.history.replaceState({}, "", nextUrl);
      showLinkFeedback("Copied!");
    } catch {
      showLinkFeedback("Copy failed");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPlannerPath =
        window.location.pathname === "/planner" ||
        window.location.pathname.startsWith("/planner/");
      if (!isPlannerPath || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "r") {
        event.preventDefault();
        if (isDragging) {
          rotateDrag(event.shiftKey ? "ccw" : "cw");
        } else {
          rotateSelected(event.shiftKey ? "ccw" : "cw");
        }
        return;
      }

      if (key === "q") {
        event.preventDefault();
        if (isDragging) {
          rotateDrag("ccw");
        } else {
          rotateSelected("ccw");
        }
        return;
      }

      if (key === "e") {
        event.preventDefault();
        if (isDragging) {
          rotateDrag("cw");
        } else {
          rotateSelected("cw");
        }
        return;
      }

      if (key === "delete" || key === "backspace") {
        if (!selectedInstanceId) {
          return;
        }
        event.preventDefault();
        removePlaced(selectedInstanceId);
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        select(null);
        return;
      }

      if (key === "u") {
        event.preventDefault();
        setMode(mode === "build" ? "unlock" : "build");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isDragging,
    mode,
    removePlaced,
    rotateDrag,
    rotateSelected,
    select,
    selectedInstanceId,
    setMode,
  ]);

  useEffect(() => {
    if (didLoadFromUrlRef.current) {
      return;
    }
    didLoadFromUrlRef.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const encoded = searchParams.get(BUILD_PARAM);
    if (!encoded) {
      return;
    }

    const decoded = decodeBuildFromString(encoded);
    if (!decoded) {
      window.setTimeout(() => {
        showLinkFeedback("Invalid share link");
      }, 0);
      return;
    }

    loadBuildState(decoded);
    window.setTimeout(() => {
      showLinkFeedback("Loaded build from link");
    }, 0);
  }, [loadBuildState]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

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
  const availableTrinkets = useMemo(
    () => allTrinkets.filter((item) => item.category === "trinket"),
    [],
  );

  const handleAddTrinket = (slot: 0 | 1 | 2, half: 0 | 1, itemId: string) => {
    const item = trinketsById[itemId];
    if (!item || item.category !== "trinket") {
      return;
    }
    if (item.isHalfTrinket) {
      setTrinket(slot, half, itemId);
      return;
    }
    setFullTrinket(slot, itemId);
  };

  const handleBoardRect = useCallback((rect: DOMRect) => {
    setBoardRect(rect);
  }, []);

  return (
    <div
      className={`min-h-screen bg-zinc-50 px-6 py-8 ${
        isDragging ? "cursor-grabbing select-none" : ""
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Mode
            </span>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
            >
              Copy Share Link
            </button>
            <button
              type="button"
              onClick={resetUnlockedToStart}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
            >
              Reset start mask
            </button>
            {linkFeedback ? (
              <span
                role="status"
                aria-live="polite"
                className="text-xs font-medium text-zinc-600"
              >
                {linkFeedback}
              </span>
            ) : null}
          </div>
        </header>
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
          Locked cells are not usable until unlocked (warning only). Press R/Q/E
          to rotate selected tile. While dragging, rotation applies to the ghost.
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <aside className="flex min-h-[320px] flex-col rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">
              Item Library
            </h2>
            <ItemLibrary
              onPick={setPickedItemId}
              onDragStart={(itemId, event) => {
                if (mode !== "build") {
                  return;
                }
                setPickedItemId(itemId);
                startLibraryDrag(itemId, event);
              }}
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
                </div>
              </div>
            ) : null}
          </aside>
          <div className="flex justify-center">
            <Board
              issues={validation.issues}
              onBoardRect={handleBoardRect}
              canDragPlaced={mode === "build"}
              hiddenInstanceId={draggedPlacedInstanceId}
              onPlacedDragStart={(instanceId, event) => {
                if (mode !== "build") {
                  return;
                }
                startPlacedDrag(instanceId, event);
              }}
              dragPreview={
                dragPreview
                  ? {
                      itemId: dragPreview.itemId,
                      anchor: dragPreview.anchor,
                      rot: dragPreview.rot,
                      valid: dragPreview.valid,
                      cells: dragPreview.cells,
                      tone: dragPreview.tone,
                      issues: dragPreview.issues,
                    }
                  : undefined
              }
            />
          </div>
          <aside className="flex min-w-[280px] flex-col gap-4">
            <TrinketSlots
              trinkets={trinkets}
              onAdd={handleAddTrinket}
              onRemove={removeTrinket}
              availableTrinkets={availableTrinkets}
            />
            <BuildSummary
              validation={validation}
              placedCount={placed.length}
              onSelectInstance={select}
            />
          </aside>
        </div>
      </div>
      {isDragging && dragItem ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm"
          style={{
            left: pointer.x + 14,
            top: pointer.y + 14,
          }}
          aria-hidden="true"
        >
          {dragItem.name}
        </div>
      ) : null}
    </div>
  );
};
