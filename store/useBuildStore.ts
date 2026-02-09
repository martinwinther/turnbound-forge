import { create } from "zustand";

import { getStartUnlockedIndices } from "@/lib/grid";

type BuildMode = "build" | "unlock";

type BuildState = {
  unlocked: number[];
  placed: [];
  mode: BuildMode;
  setMode: (mode: BuildMode) => void;
  toggleUnlocked: (index: number) => void;
  resetUnlockedToStart: () => void;
};

const startUnlocked = getStartUnlockedIndices();

export const useBuildStore = create<BuildState>((set, get) => ({
  unlocked: startUnlocked,
  placed: [],
  mode: "build",
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
}));
