"use client";

import { useMemo } from "react";

import { ShapePreview } from "@/components/ShapePreview";
import type { Item } from "@/lib/types";

type ItemTooltipProps = {
  item: Item;
  open: boolean;
  anchorRect: DOMRect | null;
  onClose?: () => void;
};

const TOOLTIP_WIDTH = 288;
const TOOLTIP_OFFSET = 10;
const VIEWPORT_PADDING = 8;

export function ItemTooltip({ item, open, anchorRect, onClose }: ItemTooltipProps) {
  const position = useMemo(() => {
    if (!anchorRect || typeof window === "undefined") {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredLeft = anchorRect.right + TOOLTIP_OFFSET;
    const fallbackLeft = anchorRect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
    const left =
      preferredLeft + TOOLTIP_WIDTH + VIEWPORT_PADDING <= viewportWidth
        ? preferredLeft
        : fallbackLeft;
    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(
        anchorRect.top,
        viewportHeight - VIEWPORT_PADDING - 220,
      ),
    );

    return {
      left: Math.max(
        VIEWPORT_PADDING,
        Math.min(left, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
      ),
      top,
    };
  }, [anchorRect]);

  if (!open || !anchorRect || !position) {
    return null;
  }

  return (
    <div
      className="fixed z-[70] w-72 rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 text-xs text-zinc-200 shadow-[0_14px_34px_rgba(0,0,0,0.5)]"
      style={{ left: position.left, top: position.top }}
      role="dialog"
      aria-label={`${item.name} details`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{item.name}</div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-400">
            {item.category}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            aria-label="Close item details"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mb-2 flex justify-center rounded-md border border-zinc-800 bg-zinc-900/70 p-2">
        <ShapePreview cells={item.shape.cells} size={11} />
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {item.tags.length > 0 ? (
          item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-zinc-500">No tags</span>
        )}
      </div>

      <p className="leading-relaxed text-zinc-300">{item.rulesText}</p>
    </div>
  );
}
