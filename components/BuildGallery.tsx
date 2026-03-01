"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteBuild,
  loadSavedBuilds,
  toggleFavorite,
  type SavedBuildV1,
} from "@/lib/storage";
import type { BuildStateV1 } from "@/lib/types";

const buttonBase =
  "rounded-md border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50";

type BuildGalleryProps = {
  open: boolean;
  onClose: () => void;
  onLoad: (state: BuildStateV1, savedId: string) => void;
  onDelete?: (id: string) => void;
};

function formatUpdatedAt(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BuildGallery({
  open,
  onClose,
  onLoad,
  onDelete,
}: BuildGalleryProps) {
  const [builds, setBuilds] = useState<SavedBuildV1[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const tick = setTimeout(() => {
      setBuilds(loadSavedBuilds());
    }, 0);
    return () => clearTimeout(tick);
  }, [open]);

  const sortedBuilds = useMemo(() => {
    return [...builds].sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return a.favorite ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [builds]);

  const handleToggleFavorite = useCallback((id: string) => {
    toggleFavorite(id);
    setBuilds(loadSavedBuilds());
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (!confirm("Delete this build?")) {
        return;
      }
      deleteBuild(id);
      onDelete?.(id);
      setBuilds(loadSavedBuilds());
    },
    [onDelete],
  );

  const handleLoad = useCallback(
    (build: SavedBuildV1) => {
      onLoad(build.state, build.id);
      onClose();
    },
    [onLoad, onClose],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="build-gallery-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <h2
            id="build-gallery-title"
            className="text-lg font-semibold text-zinc-100"
          >
            Saved Builds
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {sortedBuilds.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No saved builds yet. Save a build from the planner to see it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedBuilds.map((build) => (
                <li
                  key={build.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-800/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-zinc-100">
                      {build.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatUpdatedAt(build.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(build.id)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400"
                      title={build.favorite ? "Unfavorite" : "Favorite"}
                      aria-label={build.favorite ? "Unfavorite" : "Favorite"}
                    >
                      <span
                        className={`text-lg ${build.favorite ? "text-amber-400" : ""}`}
                      >
                        {build.favorite ? "★" : "☆"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoad(build)}
                      className={`${buttonBase} border-amber-500/70 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30`}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(build.id)}
                      className={`${buttonBase} border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-200`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
