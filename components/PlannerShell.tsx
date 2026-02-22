"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "@/components/Board";
import { BuildSummary } from "@/components/BuildSummary";
import { ItemLibrary } from "@/components/ItemLibrary";
import { TrinketSlots } from "@/components/TrinketSlots";
import { items, itemsById, trinkets as allTrinkets, trinketsById } from "@/lib/data";
import { GRID_H, GRID_W } from "@/lib/grid";
import type { Cell } from "@/lib/polyomino";
import { getOccupiedCells } from "@/lib/polyomino";
import { BUILD_PARAM, decodeBuildFromString, encodeBuildToString } from "@/lib/share";
import type { BuildStateV1 } from "@/lib/types";
import { useDragSession } from "@/lib/useDragSession";
import { validateBuild } from "@/lib/validate";
import { useBuildStore } from "@/store/useBuildStore";

const modeButtonBase =
  "rounded-md border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900";
const actionButtonBase =
  "rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-45";
const keyHintClass =
  "rounded-full border border-zinc-600/80 bg-zinc-900/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300";

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
  const undo = useBuildStore((state) => state.undo);
  const redo = useBuildStore((state) => state.redo);
  const canUndo = useBuildStore((state) => state.canUndo());
  const canRedo = useBuildStore((state) => state.canRedo());
  const dragPreviewRef = useRef<{
    anchor: Cell | null;
    valid: boolean;
  } | null>(null);

  const {
    isDragging,
    dragKind,
    dragItemId,
    dragInstanceId,
    dragGrabOffset,
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
  const dragItem = dragItemId ? itemsById[dragItemId] : null;

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

    const pointerCell = {
      x: Math.floor(relativeX / cellSize),
      y: Math.floor(relativeY / cellSize),
    };
    const nextAnchor =
      dragKind === "placed"
        ? {
            x: pointerCell.x - dragGrabOffset.x,
            y: pointerCell.y - dragGrabOffset.y,
          }
        : pointerCell;
    setAnchor(nextAnchor);
  }, [boardRect, dragGrabOffset, dragKind, isDragging, pointer, setAnchor]);

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
      const isHistoryShortcut = event.metaKey || event.ctrlKey;

      if (isHistoryShortcut && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (isHistoryShortcut && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }

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
    redo,
    select,
    selectedInstanceId,
    setMode,
    undo,
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
  const baselineErrorIds = useMemo(
    () =>
      new Set(
        validation.issues
          .filter((issue) => issue.level === "error")
          .map((issue) => issue.id),
      ),
    [validation.issues],
  );

  const isBuildMode = mode === "build";
  const isUnlockMode = mode === "unlock";
  const availableTrinkets = useMemo(
    () => allTrinkets.filter((item) => item.category === "trinket"),
    [],
  );

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

    const previewInstanceId = dragKind === "library" ? "__preview__" : dragInstanceId;
    const issues: string[] = [];
    let blockingErrors: string[] = [];
    let lockedWarnings = 0;

    if (anchor == null || !previewInstanceId) {
      issues.push("outside-board");
      blockingErrors.push("Outside board");
    } else {
      let previewPlaced = placed;
      if (dragKind === "library") {
        previewPlaced = [
          ...placed,
          {
            instanceId: previewInstanceId,
            itemId: dragItemId,
            x: anchor.x,
            y: anchor.y,
            rot,
          },
        ];
      } else if (dragKind === "placed") {
        previewPlaced = placed.map((tile) =>
          tile.instanceId === previewInstanceId
            ? {
                ...tile,
                x: anchor.x,
                y: anchor.y,
                rot,
              }
            : tile,
        );
      }

      const previewState: BuildStateV1 = { v: 1, unlocked, placed: previewPlaced, trinkets };
      const previewValidation = validateBuild({
        state: previewState,
        itemsById: itemsByIdAll,
        gridW: GRID_W,
        gridH: GRID_H,
      });
      const previewErrors = previewValidation.issues.filter(
        (issue) => issue.level === "error",
      );
      const newErrors = previewErrors.filter((issue) => !baselineErrorIds.has(issue.id));
      blockingErrors = newErrors.map((issue) => issue.message);

      const previewLockedWarnings = previewValidation.issues.filter(
        (issue) =>
          issue.level === "warning" &&
          issue.instanceId === previewInstanceId &&
          issue.id.startsWith("locked-cell-"),
      );
      lockedWarnings = previewLockedWarnings.length;

      if (newErrors.some((issue) => issue.id.startsWith("out-of-bounds-"))) {
        issues.push("out-of-bounds");
      }
      if (newErrors.some((issue) => issue.id.startsWith("overlap-"))) {
        issues.push("overlap");
      }
      if (newErrors.some((issue) => issue.id.startsWith("unique-duplicate-"))) {
        issues.push("unique-duplicate");
      }
      if (newErrors.some((issue) => issue.id === "weapon-cap")) {
        issues.push("weapon-cap");
      }
      if (lockedWarnings > 0) {
        issues.push("locked-cells-warning");
      }
    }

    const valid = anchor != null && blockingErrors.length === 0;
    const tone: "valid" | "invalid" | "warning" = !valid
      ? "invalid"
      : lockedWarnings > 0
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
      blockingReason: blockingErrors[0] ?? null,
    };
  }, [
    anchor,
    baselineErrorIds,
    dragInstanceId,
    dragItem,
    dragItemId,
    dragKind,
    placed,
    rot,
    trinkets,
    unlocked,
  ]);

  useEffect(() => {
    dragPreviewRef.current = dragPreview
      ? { anchor: dragPreview.anchor, valid: dragPreview.valid }
      : null;
  }, [dragPreview]);

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
      className={`px-4 py-6 sm:px-6 sm:py-8 ${
        isDragging ? "cursor-grabbing select-none" : ""
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.28)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Mode
            </span>
            <button
              type="button"
              onClick={() => setMode("build")}
              aria-pressed={isBuildMode}
              className={`${modeButtonBase} ${
                isBuildMode
                  ? "border-amber-400/70 bg-amber-500 text-zinc-950 shadow-[0_0_20px_rgba(251,146,60,0.35)]"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
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
                  ? "border-emerald-500/70 bg-emerald-600 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
              }`}
            >
              Unlock
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Redo
            </button>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`${actionButtonBase} border-amber-400/70 bg-amber-500 text-zinc-950 hover:bg-amber-400`}
            >
              Copy Share Link
            </button>
            <button
              type="button"
              onClick={resetUnlockedToStart}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Reset start mask
            </button>
            <span className={keyHintClass}>R rotate</span>
            <span className={keyHintClass}>Q/E rotate</span>
            <span className={keyHintClass}>Del remove</span>
            {linkFeedback ? (
              <span
                role="status"
                aria-live="polite"
                className="text-xs font-semibold text-amber-300"
              >
                {linkFeedback}
              </span>
            ) : null}
          </div>
        </header>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-xs text-zinc-300">
          Locked cells are not usable until unlocked (warning only). Press R/Q/E
          to rotate selected tile. While dragging, rotation applies to the ghost.
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_360px]">
          <aside className="flex min-h-[320px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
              Item Library
            </h2>
            <p className="mb-3 text-xs text-zinc-400">Drag items onto the board.</p>
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
          </aside>
          <div className="flex justify-center lg:justify-start xl:justify-center">
            <Board
              issues={validation.issues}
              onBoardRect={handleBoardRect}
              canDragPlaced={mode === "build"}
              hiddenInstanceId={draggedPlacedInstanceId}
              onPlacedDragStart={(instanceId, grabbedCell, event) => {
                if (mode !== "build") {
                  return;
                }
                startPlacedDrag(instanceId, event, grabbedCell);
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
          <aside className="flex min-w-[280px] flex-col gap-4 lg:col-span-2 xl:col-span-1">
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
          className="pointer-events-none fixed z-50 rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs font-semibold text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          style={{
            left: pointer.x + 14,
            top: pointer.y + 14,
          }}
          aria-hidden="true"
        >
          <div>{dragItem.name}</div>
          {dragPreview?.tone === "invalid" && dragPreview.blockingReason ? (
            <div className="text-[11px] font-medium text-red-400">
              {dragPreview.blockingReason}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
