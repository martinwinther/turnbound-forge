"use client";

type TileContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  onRotateCw: () => void;
  onRotateCcw: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
};

const MENU_WIDTH = 180;
const MENU_HEIGHT = 180;
const VIEWPORT_PADDING = 8;

export function TileContextMenu({
  open,
  x,
  y,
  onRotateCw,
  onRotateCcw,
  onDuplicate,
  onRemove,
  onClose,
}: TileContextMenuProps) {
  if (!open) {
    return null;
  }

  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(x, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING),
  );
  const top = Math.max(
    VIEWPORT_PADDING,
    Math.min(y, viewportHeight - MENU_HEIGHT - VIEWPORT_PADDING),
  );

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="absolute w-[180px] rounded-lg border border-zinc-700 bg-zinc-950/95 p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.5)]"
        style={{ left, top }}
        role="menu"
        aria-label="Tile actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => handleAction(onRotateCw)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          Rotate CW
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleAction(onRotateCcw)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          Rotate CCW
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleAction(onDuplicate)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          Duplicate
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleAction(onRemove)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm text-red-300 transition hover:bg-red-500/20"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
