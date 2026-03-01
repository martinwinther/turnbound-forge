"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "@/components/Board";
import { BuildGallery } from "@/components/BuildGallery";
import { BuildSummary } from "@/components/BuildSummary";
import { ItemLibrary } from "@/components/ItemLibrary";
import { TileContextMenu } from "@/components/TileContextMenu";
import { TrinketSlots } from "@/components/TrinketSlots";
import { items, itemsById, trinkets as allTrinkets, trinketsById } from "@/lib/data";
import { getHeroCells, getStartUnlockedSet, GRID_H, GRID_W } from "@/lib/grid";
import { findNearestValidAnchor } from "@/lib/placement";
import type { Cell } from "@/lib/polyomino";
import { getOccupiedCells } from "@/lib/polyomino";
import {
  BUILD_PARAM,
  decodeBuildFromString,
  decodeExportFileFromJson,
  encodeBuildToString,
  type ExportFileV1,
} from "@/lib/share";
import {
  loadSavedBuilds,
  upsertBuild,
  type SavedBuildV1,
} from "@/lib/storage";
import type { BuildStateV1, Rotation } from "@/lib/types";
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
const menuActionRotations: Rotation[] = [0, 90, 180, 270];

const formatExportTimestamp = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
};

type TileContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  instanceId: string | null;
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest(interactiveTextSelector));
};

const createSavedBuildId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `build-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const PlannerShell = () => {
  const [pickedItemId, setPickedItemId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentSavedBuildId, setCurrentSavedBuildId] = useState<string | null>(
    null,
  );
  const [currentSavedBuildName, setCurrentSavedBuildName] = useState<
    string | null
  >(null);
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null);
  const [tileContextMenu, setTileContextMenu] = useState<TileContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    instanceId: null,
  });
  const feedbackTimeoutRef = useRef<number | null>(null);
  const didLoadFromUrlRef = useRef(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const mode = useBuildStore((state) => state.mode);
  const unlocked = useBuildStore((state) => state.unlocked);
  const heroAnchor = useBuildStore((state) => state.heroAnchor);
  const placed = useBuildStore((state) => state.placed);
  const trinkets = useBuildStore((state) => state.trinkets);
  const selectedInstanceId = useBuildStore((state) => state.selectedInstanceId);
  const setMode = useBuildStore((state) => state.setMode);
  const loadBuildState = useBuildStore((state) => state.loadBuildState);
  const getBuildState = useBuildStore((state) => state.getBuildState);
  const batchSetUnlocked = useBuildStore((state) => state.batchSetUnlocked);
  const select = useBuildStore((state) => state.select);
  const resetUnlockedToStart = useBuildStore(
    (state) => state.resetUnlockedToStart,
  );
  const setHeroAnchor = useBuildStore((state) => state.setHeroAnchor);
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
  const heroDragPreviewRef = useRef<{
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
    startHeroDrag,
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
      if (sessionState.dragKind === "hero") {
        const preview = heroDragPreviewRef.current;
        if (!preview || !preview.anchor || !preview.valid) {
          return;
        }
        setHeroAnchor(preview.anchor.x, preview.anchor.y);
        return;
      }

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
  const isDraggingHero = isDragging && dragKind === "hero";
  const selectedTile = selectedInstanceId
    ? placed.find((tile) => tile.instanceId === selectedInstanceId) ?? null
    : null;
  const closeTileContextMenu = useCallback(() => {
    setTileContextMenu({ open: false, x: 0, y: 0, instanceId: null });
  }, []);

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
      dragKind === "placed" || dragKind === "hero"
        ? {
            x: pointerCell.x - dragGrabOffset.x,
            y: pointerCell.y - dragGrabOffset.y,
          }
        : pointerCell;
    setAnchor(nextAnchor);
  }, [boardRect, dragGrabOffset, dragKind, isDragging, pointer, setAnchor]);

  const showLinkFeedback = useCallback((message: string) => {
    setLinkFeedback(message);
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setLinkFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 1500);
  }, []);

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

  const handleExportJson = useCallback(() => {
    try {
      const state = getBuildState();
      const exportFile: ExportFileV1 = {
        app: "turnbound-forge",
        v: 1,
        createdAt: new Date().toISOString(),
        state,
      };
      const json = JSON.stringify(exportFile, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `turnbound-forge-build-${formatExportTimestamp(new Date())}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      showLinkFeedback("Exported build");
    } catch {
      showLinkFeedback("Export failed");
    }
  }, [getBuildState, showLinkFeedback]);

  const handleImportJsonClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportJson = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = "";
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const decodedExport = decodeExportFileFromJson(text);
        if (!decodedExport) {
          showLinkFeedback("Invalid build file");
          return;
        }
        loadBuildState(decodedExport.state);
        showLinkFeedback("Imported build");
      } catch {
        showLinkFeedback("Invalid build file");
      }
    },
    [loadBuildState, showLinkFeedback],
  );

  const handleSave = useCallback(() => {
    const state = getBuildState();
    const now = new Date().toISOString();

    if (currentSavedBuildId) {
      const list = loadSavedBuilds();
      const existing = list.find((b) => b.id === currentSavedBuildId);
      if (existing) {
        const updated: SavedBuildV1 = {
          ...existing,
          updatedAt: now,
          state,
        };
        upsertBuild(updated);
        setCurrentSavedBuildName(existing.name);
        showLinkFeedback("Saved ✓");
        return;
      }
    }

    const rawName =
      typeof window !== "undefined"
        ? window.prompt("Build name", currentSavedBuildName ?? "Untitled build")
        : null;
    const name = (rawName?.trim() || "Untitled build") as string;
    const build: SavedBuildV1 = {
      id: createSavedBuildId(),
      v: 1,
      name,
      createdAt: now,
      updatedAt: now,
      favorite: false,
      state,
    };
    upsertBuild(build);
    setCurrentSavedBuildId(build.id);
    setCurrentSavedBuildName(build.name);
    showLinkFeedback("Saved ✓");
  }, [
    currentSavedBuildId,
    currentSavedBuildName,
    getBuildState,
    showLinkFeedback,
  ]);

  const handleSaveAs = useCallback(() => {
    const state = getBuildState();
    const now = new Date().toISOString();
    const rawName =
      typeof window !== "undefined"
        ? window.prompt("Build name", currentSavedBuildName ?? "Untitled build")
        : null;
    const saveAsName = (rawName?.trim() || "Untitled build") as string;
    const build: SavedBuildV1 = {
      id: createSavedBuildId(),
      v: 1,
      name: saveAsName,
      createdAt: now,
      updatedAt: now,
      favorite: false,
      state,
    };
    upsertBuild(build);
    setCurrentSavedBuildId(build.id);
    setCurrentSavedBuildName(build.name);
    showLinkFeedback("Saved ✓");
  }, [currentSavedBuildName, getBuildState, showLinkFeedback]);

  const handleGalleryLoad = useCallback(
    (state: BuildStateV1, savedId: string) => {
      loadBuildState(state);
      const list = loadSavedBuilds();
      const build = list.find((b) => b.id === savedId);
      setCurrentSavedBuildId(savedId);
      setCurrentSavedBuildName(build?.name ?? null);
      setGalleryOpen(false);
      showLinkFeedback("Loaded build");
    },
    [loadBuildState, showLinkFeedback],
  );

  const handleGalleryDelete = useCallback(
    (id: string) => {
      if (id === currentSavedBuildId) {
        setCurrentSavedBuildId(null);
        setCurrentSavedBuildName(null);
      }
      showLinkFeedback("Deleted");
    },
    [currentSavedBuildId, showLinkFeedback],
  );

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

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? "ccw" : "cw";
        if (isDragging && dragKind !== "hero") {
          rotateDrag(direction);
        } else {
          rotateSelected(direction);
        }
        return;
      }

      if (key === "r") {
        event.preventDefault();
        if (isDragging && dragKind !== "hero") {
          rotateDrag(event.shiftKey ? "ccw" : "cw");
        } else {
          rotateSelected(event.shiftKey ? "ccw" : "cw");
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
        closeTileContextMenu();
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
    dragKind,
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
    closeTileContextMenu,
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
  }, [loadBuildState, showLinkFeedback]);

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
        state: { v: 1, heroAnchor, unlocked, placed, trinkets },
        itemsById: itemsByIdAll,
        gridW: GRID_W,
        gridH: GRID_H,
      }),
    [heroAnchor, unlocked, placed, trinkets],
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
      previewState.heroAnchor = heroAnchor;
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
    heroAnchor,
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

  const heroDragPreview = useMemo(() => {
    if (!isDraggingHero) {
      return null;
    }

    const candidateAnchor = anchor;
    if (!candidateAnchor) {
      return { anchor: null, valid: false, tone: "invalid" as const };
    }

    const heroCells = getHeroCells(candidateAnchor);
    const isInBounds = heroCells.every(
      (cell) => cell.x >= 0 && cell.x < GRID_W && cell.y >= 0 && cell.y < GRID_H,
    );
    if (!isInBounds) {
      return { anchor: candidateAnchor, valid: false, tone: "invalid" as const };
    }

    const previewValidation = validateBuild({
      state: { v: 1, heroAnchor: candidateAnchor, unlocked, placed, trinkets },
      itemsById: itemsByIdAll,
      gridW: GRID_W,
      gridH: GRID_H,
    });
    const newErrors = previewValidation.issues.filter(
      (issue) => issue.level === "error" && !baselineErrorIds.has(issue.id),
    );
    const valid = newErrors.length === 0;

    return {
      anchor: candidateAnchor,
      valid,
      tone: valid ? ("valid" as const) : ("invalid" as const),
    };
  }, [anchor, baselineErrorIds, isDraggingHero, placed, trinkets, unlocked]);

  useEffect(() => {
    heroDragPreviewRef.current = heroDragPreview
      ? { anchor: heroDragPreview.anchor, valid: heroDragPreview.valid }
      : null;
  }, [heroDragPreview]);

  const renderedHeroAnchor = heroDragPreview?.anchor ?? heroAnchor;
  const startUnlockedSet = useMemo(() => getStartUnlockedSet(), []);
  const unlockedCount = unlocked.length;
  const coinsSpent = useMemo(() => {
    return unlocked.reduce((count, index) => {
      if (startUnlockedSet.has(index)) {
        return count;
      }
      return count + 1;
    }, 0);
  }, [startUnlockedSet, unlocked]);

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

  const rotatePlacedByDirection = useCallback(
    (instanceId: string, direction: "cw" | "ccw") => {
      const tile = placed.find((entry) => entry.instanceId === instanceId);
      if (!tile) {
        return;
      }

      const index = menuActionRotations.indexOf(tile.rot);
      const offset = direction === "cw" ? 1 : -1;
      const nextRotation =
        menuActionRotations[(index + offset + menuActionRotations.length) % menuActionRotations.length];
      setPlacedRotation(instanceId, nextRotation);
      select(instanceId);
    },
    [placed, select, setPlacedRotation],
  );

  const duplicatePlacedByInstance = useCallback(
    (instanceId: string) => {
      const tile = placed.find((entry) => entry.instanceId === instanceId);
      if (!tile) {
        return;
      }
      const item = itemsById[tile.itemId];
      if (!item) {
        showLinkFeedback("Item data missing");
        return;
      }

      const buildState = getBuildState();
      const nearestAnchor = findNearestValidAnchor({
        start: { x: tile.x + 1, y: tile.y },
        item,
        rot: tile.rot,
        state: buildState,
        itemsById: itemsByIdAll,
      });

      if (!nearestAnchor) {
        showLinkFeedback("No space to duplicate");
        return;
      }

      addPlaced(item.id, nearestAnchor.x, nearestAnchor.y, tile.rot);
    },
    [addPlaced, getBuildState, placed, showLinkFeedback],
  );

  return (
    <div
      className={`px-4 py-6 sm:px-6 sm:py-8 ${
        isDragging ? "cursor-grabbing select-none" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full flex-col gap-5 ${
          isScreenshotMode ? "max-w-[1680px]" : "max-w-[1440px]"
        }`}
      >
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
            <span className={keyHintClass}>{`Unlocked: ${unlockedCount} / 49`}</span>
            <span className={keyHintClass}>{`Coins spent: ${coinsSpent}`}</span>
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
              onClick={handleSave}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleSaveAs}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Save As
            </button>
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Gallery
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
              onClick={handleExportJson}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleImportJsonClick}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Import JSON
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={handleImportJson}
            />
            <button
              type="button"
              onClick={resetUnlockedToStart}
              className={`${actionButtonBase} border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500`}
            >
              Reset start mask
            </button>
            <button
              type="button"
              onClick={() => setIsScreenshotMode((value) => !value)}
              aria-pressed={isScreenshotMode}
              className={`${actionButtonBase} ${
                isScreenshotMode
                  ? "border-sky-500/70 bg-sky-600/25 text-sky-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
              }`}
            >
              Screenshot Mode
            </button>
            <span className={keyHintClass}>Drag rotate: ← / → or wheel</span>
            <span className={keyHintClass}>Also: R / Shift+R</span>
            <span className={keyHintClass}>Del remove</span>
            {currentSavedBuildName ? (
              <span className="text-xs text-zinc-500">
                Editing: {currentSavedBuildName}
              </span>
            ) : null}
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
        {!isScreenshotMode ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-xs text-zinc-300">
            {isUnlockMode
              ? "Paint to unlock/lock. First cell decides mode."
              : "Locked cells are not usable until unlocked (warning only). Rotate while dragging: ← / → or mouse wheel. Also: R / Shift+R."}
          </div>
        ) : null}

        <div
          className={`grid grid-cols-1 gap-6 ${
            isScreenshotMode ? "xl:grid-cols-[1fr_360px]" : "lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_360px]"
          }`}
        >
          {!isScreenshotMode ? (
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
          ) : null}
          <div className="flex justify-center">
            <Board
              mode={mode}
              heroAnchor={renderedHeroAnchor}
              issues={validation.issues}
              onBoardRect={handleBoardRect}
              onPaintToggle={(indices, makeUnlocked) => {
                batchSetUnlocked(indices, makeUnlocked);
              }}
              onUnlockStatus={(message) => {
                showLinkFeedback(message);
              }}
              canDragPlaced={mode === "build"}
              hiddenInstanceId={draggedPlacedInstanceId}
              heroDragTone={isDraggingHero ? heroDragPreview?.tone ?? "invalid" : null}
              onHeroDragStart={(grabbedCell, event) => {
                startHeroDrag(event, grabbedCell);
              }}
              onPlacedDragStart={(instanceId, grabbedCell, event) => {
                if (mode !== "build") {
                  return;
                }
                startPlacedDrag(instanceId, event, grabbedCell);
              }}
              onTileContextMenu={({ instanceId, x, y }) => {
                select(instanceId);
                setTileContextMenu({ open: true, x, y, instanceId });
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
          <aside
            className={`flex min-w-[280px] flex-col gap-4 ${
              isScreenshotMode ? "" : "lg:col-span-2 xl:col-span-1"
            }`}
          >
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
              onDuplicateSelected={() => {
                if (!selectedTile) {
                  return;
                }
                duplicatePlacedByInstance(selectedTile.instanceId);
              }}
              onOpenSelectedTileMenu={(anchorRect) => {
                if (!selectedTile) {
                  return;
                }
                setTileContextMenu({
                  open: true,
                  x: anchorRect.right + 6,
                  y: anchorRect.bottom + 6,
                  instanceId: selectedTile.instanceId,
                });
              }}
            />
          </aside>
        </div>
        {isScreenshotMode ? (
          <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Turnbound Forge
          </div>
        ) : null}
      </div>
      <BuildGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onLoad={handleGalleryLoad}
        onDelete={handleGalleryDelete}
      />
      <TileContextMenu
        open={tileContextMenu.open}
        x={tileContextMenu.x}
        y={tileContextMenu.y}
        onClose={closeTileContextMenu}
        onRotateCw={() => {
          if (!tileContextMenu.instanceId) {
            return;
          }
          rotatePlacedByDirection(tileContextMenu.instanceId, "cw");
        }}
        onRotateCcw={() => {
          if (!tileContextMenu.instanceId) {
            return;
          }
          rotatePlacedByDirection(tileContextMenu.instanceId, "ccw");
        }}
        onDuplicate={() => {
          if (!tileContextMenu.instanceId) {
            return;
          }
          duplicatePlacedByInstance(tileContextMenu.instanceId);
        }}
        onRemove={() => {
          if (!tileContextMenu.instanceId) {
            return;
          }
          removePlaced(tileContextMenu.instanceId);
          select(null);
        }}
      />
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
