import { validateBuildStateShape } from "@/lib/share";
import type { BuildStateV1 } from "@/lib/types";

export const SAVED_BUILDS_KEY = "turnbound-forge:builds";

export type SavedBuildV1 = {
  id: string;
  v: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  state: BuildStateV1;
};

function isSavedBuildV1(value: unknown): value is SavedBuildV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id === "" ||
    candidate.v !== 1 ||
    typeof candidate.name !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.favorite !== "boolean"
  ) {
    return false;
  }

  if (!validateBuildStateShape(candidate.state)) {
    return false;
  }

  return true;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Load saved builds from localStorage. Returns [] on missing key, invalid JSON,
 * or invalid/corrupted records (filters out bad entries, does not throw).
 */
export function loadSavedBuilds(): SavedBuildV1[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(SAVED_BUILDS_KEY);
    if (raw == null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: SavedBuildV1[] = [];
    for (const entry of parsed) {
      if (isSavedBuildV1(entry)) {
        result.push(entry);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveSavedBuilds(list: SavedBuildV1[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SAVED_BUILDS_KEY, JSON.stringify(list));
  } catch {
    // Quota or other storage error; fail silently
  }
}

export function upsertBuild(build: SavedBuildV1): void {
  if (!isSavedBuildV1(build)) {
    return;
  }
  const list = loadSavedBuilds();
  const index = list.findIndex((b) => b.id === build.id);
  const next = [...list];
  if (index >= 0) {
    next[index] = build;
  } else {
    next.push(build);
  }
  saveSavedBuilds(next);
}

export function deleteBuild(id: string): void {
  const list = loadSavedBuilds().filter((b) => b.id !== id);
  saveSavedBuilds(list);
}

export function toggleFavorite(id: string): void {
  const list = loadSavedBuilds();
  const build = list.find((b) => b.id === id);
  if (!build) {
    return;
  }
  const updated: SavedBuildV1 = { ...build, favorite: !build.favorite };
  const next = list.map((b) => (b.id === id ? updated : b));
  saveSavedBuilds(next);
}
