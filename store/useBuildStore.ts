import { create } from "zustand";

import { getStartUnlockedIndices } from "@/lib/grid";
import type { BuildStateV1, Item, Rotation } from "@/lib/types";

type BuildMode = "build" | "unlock";
type RotationDirection = "cw" | "ccw";
type PlacedTile = BuildStateV1["placed"][number];

type BuildState = {
  unlocked: number[];
  placed: BuildStateV1["placed"];
  trinkets: BuildStateV1["trinkets"];
  selectedInstanceId: string | null;
  mode: BuildMode;
  loadBuildState: (next: BuildStateV1) => void;
  getBuildState: () => BuildStateV1;
  setMode: (mode: BuildMode) => void;
  toggleUnlocked: (index: number) => void;
  resetUnlockedToStart: () => void;
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
};

const startUnlocked = getStartUnlockedIndices();
const rotations: Rotation[] = [0, 90, 180, 270];

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

export const useBuildStore = create<BuildState>((set, get) => ({
  unlocked: startUnlocked,
  placed: [],
  trinkets: [],
  selectedInstanceId: null,
  mode: "build",
  loadBuildState: (next) => {
    set((state) => ({
      mode: state.mode,
      unlocked: [...next.unlocked],
      placed: [...next.placed],
      trinkets: [...next.trinkets],
      selectedInstanceId: null,
    }));
  },
  getBuildState: () => {
    const { unlocked, placed, trinkets } = get();
    return {
      v: 1,
      unlocked: sortUnlocked(unlocked),
      placed: sortPlaced(placed),
      trinkets: sortTrinkets(trinkets),
    };
  },
  setMode: (mode) => set({ mode }),
  toggleUnlocked: (index) => {
    if (get().mode !== "unlock") {
      return;
    }
    set((state) => {
      const isUnlocked = state.unlocked.includes(index);
      if (isUnlocked) {
        return { unlocked: state.unlocked.filter((value) => value !== index) };
      }
      return { unlocked: [...state.unlocked, index] };
    });
  },
  resetUnlockedToStart: () => set({ unlocked: startUnlocked }),
  addPlaced: (itemId, x, y, rot = 0) => {
    const tile: PlacedTile = {
      instanceId: createInstanceId(),
      itemId,
      x,
      y,
      rot,
    };

    set((state) => ({
      placed: [...state.placed, tile],
      selectedInstanceId: tile.instanceId,
    }));
  },
  removePlaced: (instanceId) => {
    set((state) => ({
      placed: state.placed.filter((tile) => tile.instanceId !== instanceId),
      selectedInstanceId:
        state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
    }));
  },
  addTrinket: (slot, half, item) => {
    if (item.isHalfTrinket) {
      get().setTrinket(slot, half, item.id);
      return;
    }
    get().setFullTrinket(slot, item.id);
  },
  setTrinket: (slot, half, itemId) => {
    set((state) => ({
      trinkets: setHalfTrinket(state.trinkets, slot, half, itemId),
    }));
  },
  setFullTrinket: (slot, itemId) => {
    set((state) => {
      const withoutSlot = state.trinkets.filter((t) => t.slot !== slot);
      return {
        trinkets: [
          ...withoutSlot,
          { slot, half: 0, itemId },
          { slot, half: 1, itemId },
        ],
      };
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

      return {
        trinkets: shouldClearSlot
          ? state.trinkets.filter((t) => t.slot !== slot)
          : state.trinkets.filter((t) => !(t.slot === slot && t.half === half)),
      };
    });
  },
  clearTrinketSlot: (slot) => {
    set((state) => ({
      trinkets: state.trinkets.filter((t) => t.slot !== slot),
    }));
  },
  select: (instanceId) => set({ selectedInstanceId: instanceId }),
  rotateSelected: (direction) => {
    const selectedInstanceId = get().selectedInstanceId;
    if (!selectedInstanceId) {
      return;
    }

    set((state) => ({
      placed: updatePlacedTile(state.placed, selectedInstanceId, (tile) => ({
        ...tile,
        rot: rotate(tile.rot, direction),
      })),
    }));
  },
  setPlacedPosition: (instanceId, x, y) => {
    set((state) => ({
      placed: updatePlacedTile(state.placed, instanceId, (tile) => ({
        ...tile,
        x,
        y,
      })),
    }));
  },
}));
