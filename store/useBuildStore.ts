import { create } from "zustand";

import {
  getHeroIndices,
  getStartUnlockedIndices,
  HERO_ANCHOR,
} from "@/lib/grid";
import type { BuildStateV1, Item, Rotation } from "@/lib/types";

type BuildMode = "build" | "unlock";
type RotationDirection = "cw" | "ccw";
type PlacedTile = BuildStateV1["placed"][number];
type HeroAnchor = { x: number; y: number };
type Snapshot = Pick<BuildStateV1, "unlocked" | "placed" | "trinkets"> & {
  heroAnchor: HeroAnchor;
};

type SnapshotSource = {
  heroAnchor: HeroAnchor;
  unlocked: BuildStateV1["unlocked"];
  placed: BuildStateV1["placed"];
  trinkets: BuildStateV1["trinkets"];
};

type BuildState = {
  unlocked: number[];
  heroAnchor: HeroAnchor;
  placed: BuildStateV1["placed"];
  trinkets: BuildStateV1["trinkets"];
  past: Snapshot[];
  future: Snapshot[];
  historyLimit: number;
  selectedInstanceId: string | null;
  mode: BuildMode;
  loadBuildState: (next: BuildStateV1) => void;
  getBuildState: () => BuildStateV1;
  setMode: (mode: BuildMode) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  toggleUnlocked: (index: number) => void;
  setUnlocked: (index: number, value: boolean) => void;
  batchSetUnlocked: (indices: number[], value: boolean) => void;
  resetUnlockedToStart: () => void;
  setHeroAnchor: (x: number, y: number) => void;
  addPlaced: (itemId: string, x: number, y: number, rot?: Rotation) => void;
  removePlaced: (instanceId: string) => void;
  addTrinket: (slot: 0 | 1 | 2, half: 0 | 1, item: Item) => void;
  setTrinket: (slot: 0 | 1 | 2, half: 0 | 1, itemId: string) => void;
  setFullTrinket: (slot: 0 | 1 | 2, itemId: string) => void;
  removeTrinket: (slot: 0 | 1 | 2, half: 0 | 1) => void;
  clearTrinketSlot: (slot: 0 | 1 | 2) => void;
  select: (instanceId: string | null) => void;
  rotateSelected: (direction: RotationDirection) => void;
  setPlacedPosition: (instanceId: string, x: number, y: number) => void;
  setPlacedRotation: (instanceId: string, rot: Rotation) => void;
};

const startUnlocked = getStartUnlockedIndices();
const heroIndices = new Set(getHeroIndices());
const rotations: Rotation[] = [0, 90, 180, 270];
const DEFAULT_HISTORY_LIMIT = 100;

const createInstanceId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `instance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const rotate = (current: Rotation, direction: RotationDirection): Rotation => {
  const currentIndex = rotations.indexOf(current);
  if (currentIndex < 0) {
    return 0;
  }

  const offset = direction === "cw" ? 1 : -1;
  const nextIndex = (currentIndex + offset + rotations.length) % rotations.length;
  return rotations[nextIndex];
};

const updatePlacedTile = (
  placed: BuildStateV1["placed"],
  instanceId: string,
  updater: (tile: PlacedTile) => PlacedTile,
) => {
  return placed.map((tile) => {
    if (tile.instanceId !== instanceId) {
      return tile;
    }

    return updater(tile);
  });
};

const setHalfTrinket = (
  trinkets: BuildStateV1["trinkets"],
  slot: 0 | 1 | 2,
  half: 0 | 1,
  itemId: string,
): BuildStateV1["trinkets"] => {
  return [
    ...trinkets.filter((t) => !(t.slot === slot && t.half === half)),
    { slot, half, itemId },
  ];
};

const sortUnlocked = (values: number[]): number[] => {
  return [...values].sort((a, b) => a - b);
};

const sortPlaced = (values: BuildStateV1["placed"]): BuildStateV1["placed"] => {
  return [...values].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
};

const sortTrinkets = (
  values: BuildStateV1["trinkets"],
): BuildStateV1["trinkets"] => {
  return [...values].sort((a, b) => {
    if (a.slot !== b.slot) {
      return a.slot - b.slot;
    }
    return a.half - b.half;
  });
};

const makeSnapshot = (state: SnapshotSource): Snapshot => {
  return {
    heroAnchor: { ...state.heroAnchor },
    unlocked: sortUnlocked(state.unlocked),
    placed: sortPlaced(state.placed),
    trinkets: sortTrinkets(state.trinkets),
  };
};

const applySnapshot = (
  snapshot: Snapshot,
): Pick<
  BuildState,
  "heroAnchor" | "unlocked" | "placed" | "trinkets" | "selectedInstanceId"
> => {
  return {
    heroAnchor: { ...snapshot.heroAnchor },
    unlocked: [...snapshot.unlocked],
    placed: [...snapshot.placed],
    trinkets: [...snapshot.trinkets],
    selectedInstanceId: null,
  };
};

const areSnapshotsEqual = (a: Snapshot, b: Snapshot): boolean => {
  if (a.heroAnchor.x !== b.heroAnchor.x || a.heroAnchor.y !== b.heroAnchor.y) {
    return false;
  }

  if (a.unlocked.length !== b.unlocked.length) {
    return false;
  }
  for (let index = 0; index < a.unlocked.length; index += 1) {
    if (a.unlocked[index] !== b.unlocked[index]) {
      return false;
    }
  }

  if (a.placed.length !== b.placed.length) {
    return false;
  }
  for (let index = 0; index < a.placed.length; index += 1) {
    const left = a.placed[index];
    const right = b.placed[index];
    if (
      left.instanceId !== right.instanceId ||
      left.itemId !== right.itemId ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.rot !== right.rot
    ) {
      return false;
    }
  }

  if (a.trinkets.length !== b.trinkets.length) {
    return false;
  }
  for (let index = 0; index < a.trinkets.length; index += 1) {
    const left = a.trinkets[index];
    const right = b.trinkets[index];
    if (
      left.slot !== right.slot ||
      left.half !== right.half ||
      left.itemId !== right.itemId
    ) {
      return false;
    }
  }

  return true;
};

const clampHistory = (history: Snapshot[], historyLimit: number): Snapshot[] => {
  if (history.length <= historyLimit) {
    return history;
  }
  return history.slice(history.length - historyLimit);
};

const setUnlockedValue = (
  unlocked: number[],
  index: number,
  value: boolean,
): number[] => {
  if (heroIndices.has(index)) {
    return unlocked;
  }

  const hasIndex = unlocked.includes(index);
  if (hasIndex === value) {
    return unlocked;
  }

  if (value) {
    return [...unlocked, index];
  }

  return unlocked.filter((entry) => entry !== index);
};

const commitSnapshotChange = (
  state: BuildState,
  nextSource: SnapshotSource,
  nextSelectedInstanceId: string | null = state.selectedInstanceId,
): Partial<BuildState> => {
  const currentSnapshot = makeSnapshot(state);
  const nextSnapshot = makeSnapshot(nextSource);
  const hasMeaningfulChange = !areSnapshotsEqual(currentSnapshot, nextSnapshot);

  if (!hasMeaningfulChange) {
    if (nextSelectedInstanceId === state.selectedInstanceId) {
      return {};
    }
    return { selectedInstanceId: nextSelectedInstanceId };
  }

  return {
    ...applySnapshot(nextSnapshot),
    selectedInstanceId: nextSelectedInstanceId,
    past: clampHistory([...state.past, currentSnapshot], state.historyLimit),
    future: [],
  };
};

export const useBuildStore = create<BuildState>((set, get) => ({
  heroAnchor: { ...HERO_ANCHOR },
  unlocked: startUnlocked,
  placed: [],
  trinkets: [],
  past: [],
  future: [],
  historyLimit: DEFAULT_HISTORY_LIMIT,
  selectedInstanceId: null,
  mode: "build",
  loadBuildState: (next) => {
    const snapshot = makeSnapshot({
      heroAnchor: next.heroAnchor ?? HERO_ANCHOR,
      unlocked: next.unlocked,
      placed: next.placed,
      trinkets: next.trinkets,
    });
    set((state) => ({
      mode: state.mode,
      ...applySnapshot(snapshot),
      past: [],
      future: [],
    }));
  },
  getBuildState: () => {
    const { heroAnchor, unlocked, placed, trinkets } = get();
    return {
      v: 1,
      heroAnchor: { ...heroAnchor },
      unlocked: sortUnlocked(unlocked),
      placed: sortPlaced(placed),
      trinkets: sortTrinkets(trinkets),
    };
  },
  setMode: (mode) => set({ mode }),
  undo: () => {
    set((state) => {
      if (state.past.length === 0) {
        return {};
      }

      const previous = state.past[state.past.length - 1];
      const currentSnapshot = makeSnapshot(state);
      return {
        ...applySnapshot(previous),
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future],
      };
    });
  },
  redo: () => {
    set((state) => {
      if (state.future.length === 0) {
        return {};
      }

      const [next, ...rest] = state.future;
      const currentSnapshot = makeSnapshot(state);
      return {
        ...applySnapshot(next),
        past: clampHistory([...state.past, currentSnapshot], state.historyLimit),
        future: rest,
      };
    });
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clearHistory: () => set({ past: [], future: [] }),
  toggleUnlocked: (index) => {
    if (get().mode !== "unlock") {
      return;
    }
    const isUnlocked = get().unlocked.includes(index);
    get().setUnlocked(index, !isUnlocked);
  },
  setUnlocked: (index, value) => {
    if (get().mode !== "unlock") {
      return;
    }

    set((state) => {
      const nextUnlocked = setUnlockedValue(state.unlocked, index, value);

      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: nextUnlocked,
          placed: state.placed,
          trinkets: state.trinkets,
        },
        state.selectedInstanceId,
      );
    });
  },
  batchSetUnlocked: (indices, value) => {
    if (get().mode !== "unlock") {
      return;
    }

    set((state) => {
      let nextUnlocked = state.unlocked;
      for (const index of indices) {
        nextUnlocked = setUnlockedValue(nextUnlocked, index, value);
      }

      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: nextUnlocked,
          placed: state.placed,
          trinkets: state.trinkets,
        },
        state.selectedInstanceId,
      );
    });
  },
  resetUnlockedToStart: () =>
    set((state) => {
      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: startUnlocked,
          placed: state.placed,
          trinkets: state.trinkets,
        },
        state.selectedInstanceId,
      );
    }),
  setHeroAnchor: (x, y) => {
    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: { x, y },
          unlocked: state.unlocked,
          placed: state.placed,
          trinkets: state.trinkets,
        },
        state.selectedInstanceId,
      ),
    );
  },
  addPlaced: (itemId, x, y, rot = 0) => {
    const tile: PlacedTile = {
      instanceId: createInstanceId(),
      itemId,
      x,
      y,
      rot,
    };

    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: [...state.placed, tile],
          trinkets: state.trinkets,
        },
        tile.instanceId,
      ),
    );
  },
  removePlaced: (instanceId) => {
    set((state) => {
      const nextSelectedInstanceId =
        state.selectedInstanceId === instanceId ? null : state.selectedInstanceId;

      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: state.placed.filter((tile) => tile.instanceId !== instanceId),
          trinkets: state.trinkets,
        },
        nextSelectedInstanceId,
      );
    });
  },
  addTrinket: (slot, half, item) => {
    if (item.isHalfTrinket) {
      get().setTrinket(slot, half, item.id);
      return;
    }
    get().setFullTrinket(slot, item.id);
  },
  setTrinket: (slot, half, itemId) => {
    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: state.placed,
          trinkets: setHalfTrinket(state.trinkets, slot, half, itemId),
        },
        state.selectedInstanceId,
      ),
    );
  },
  setFullTrinket: (slot, itemId) => {
    set((state) => {
      const withoutSlot = state.trinkets.filter((t) => t.slot !== slot);
      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: state.placed,
          trinkets: [
            ...withoutSlot,
            { slot, half: 0, itemId },
            { slot, half: 1, itemId },
          ],
        },
        state.selectedInstanceId,
      );
    });
  },
  removeTrinket: (slot, half) => {
    set((state) => {
      const slotEntries = state.trinkets.filter((t) => t.slot === slot);
      const selected = slotEntries.find((t) => t.half === half);
      const otherHalf = half === 0 ? 1 : 0;
      const other = slotEntries.find((t) => t.half === otherHalf);
      const shouldClearSlot =
        selected != null &&
        other != null &&
        selected.itemId === other.itemId;

      return commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: state.placed,
          trinkets: shouldClearSlot
            ? state.trinkets.filter((t) => t.slot !== slot)
            : state.trinkets.filter((t) => !(t.slot === slot && t.half === half)),
        },
        state.selectedInstanceId,
      );
    });
  },
  clearTrinketSlot: (slot) => {
    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: state.placed,
          trinkets: state.trinkets.filter((t) => t.slot !== slot),
        },
        state.selectedInstanceId,
      ),
    );
  },
  select: (instanceId) => set({ selectedInstanceId: instanceId }),
  rotateSelected: (direction) => {
    const selectedInstanceId = get().selectedInstanceId;
    if (!selectedInstanceId) {
      return;
    }

    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: updatePlacedTile(state.placed, selectedInstanceId, (tile) => ({
            ...tile,
            rot: rotate(tile.rot, direction),
          })),
          trinkets: state.trinkets,
        },
        state.selectedInstanceId,
      ),
    );
  },
  setPlacedPosition: (instanceId, x, y) => {
    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: updatePlacedTile(state.placed, instanceId, (tile) => ({
            ...tile,
            x,
            y,
          })),
          trinkets: state.trinkets,
        },
        instanceId,
      ),
    );
  },
  setPlacedRotation: (instanceId, rot) => {
    set((state) =>
      commitSnapshotChange(
        state,
        {
          heroAnchor: state.heroAnchor,
          unlocked: state.unlocked,
          placed: updatePlacedTile(state.placed, instanceId, (tile) => ({
            ...tile,
            rot,
          })),
          trinkets: state.trinkets,
        },
        instanceId,
      ),
    );
  },
}));
