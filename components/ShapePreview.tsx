"use client";

import { useMemo } from "react";
import { normalizeCells } from "@/lib/polyomino";
import { getBoundingBox } from "@/lib/polyomino";

const DEFAULT_SIZE = 11;

type ShapePreviewProps = {
  cells: Array<[number, number]>;
  size?: number;
};

export function ShapePreview({ cells, size = DEFAULT_SIZE }: ShapePreviewProps) {
  const { normalized, width, height, cellSet } = useMemo(() => {
    const normalized = normalizeCells(cells);
    if (normalized.length === 0) {
      return { normalized, width: 0, height: 0, cellSet: new Set<string>() };
    }
    const asCells = normalized.map(([x, y]) => ({ x, y }));
    const box = getBoundingBox(asCells);
    const cellSet = new Set(normalized.map(([x, y]) => `${x},${y}`));
    return {
      normalized,
      width: box.w,
      height: box.h,
      cellSet,
    };
  }, [cells]);

  if (normalized.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-zinc-200 bg-zinc-50"
        style={{ width: size * 2, height: size * 2 }}
        aria-hidden
      >
        <span className="text-[8px] text-zinc-400">—</span>
      </div>
    );
  }

  return (
    <div
      className="grid gap-px rounded border border-zinc-200 bg-zinc-200 p-px"
      style={{
        width: width * size + 2,
        height: height * size + 2,
        gridTemplateColumns: `repeat(${width}, ${size}px)`,
        gridTemplateRows: `repeat(${height}, ${size}px)`,
      }}
      aria-hidden
    >
      {Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, col) => {
          const key = `${col},${row}`;
          const filled = cellSet.has(key);
          return (
            <div
              key={key}
              className={filled ? "bg-zinc-700" : "bg-transparent"}
              style={{ width: size, height: size }}
            />
          );
        }),
      ).flat()}
    </div>
  );
}
