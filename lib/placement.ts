import { GRID_H, GRID_W, isHeroCell } from "@/lib/grid";
import { getOccupiedCells } from "@/lib/polyomino";
import type { BuildStateV1, Item, Rotation } from "@/lib/types";
import { validateBuild } from "@/lib/validate";

type FindNearestValidAnchorArgs = {
  start: { x: number; y: number };
  item: Item;
  rot: Rotation;
  state: BuildStateV1;
  itemsById: Record<string, Item>;
  maxRadius?: number;
};

const PREVIEW_INSTANCE_ID = "__snap_preview__";
const DEFAULT_MAX_RADIUS = Math.max(GRID_W, GRID_H);

const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;

const getRingCandidates = (start: { x: number; y: number }, radius: number) => {
  if (radius === 0) {
    return [{ x: start.x, y: start.y }];
  }

  const candidates: Array<{ x: number; y: number }> = [];
  for (let yOffset = -radius; yOffset <= radius; yOffset += 1) {
    for (let xOffset = -radius; xOffset <= radius; xOffset += 1) {
      if (Math.max(Math.abs(xOffset), Math.abs(yOffset)) !== radius) {
        continue;
      }

      candidates.push({
        x: start.x + xOffset,
        y: start.y + yOffset,
      });
    }
  }

  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x - start.x) + Math.abs(left.y - start.y);
    const rightDistance = Math.abs(right.x - start.x) + Math.abs(right.y - start.y);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });

  return candidates;
};

export function findNearestValidAnchor({
  start,
  item,
  rot,
  state,
  itemsById,
  maxRadius = DEFAULT_MAX_RADIUS,
}: FindNearestValidAnchorArgs): { x: number; y: number } | null {
  const roundedStart = {
    x: Math.round(start.x),
    y: Math.round(start.y),
  };
  const heroAnchor = state.heroAnchor ?? { x: 3, y: 3 };

  const occupiedCells = new Set<string>();
  for (const placedTile of state.placed) {
    const placedItem = itemsById[placedTile.itemId];
    if (!placedItem) {
      continue;
    }
    const cells = getOccupiedCells({
      anchor: { x: placedTile.x, y: placedTile.y },
      shapeCells: placedItem.shape.cells,
      pivot: placedItem.shape.pivot,
      rot: placedTile.rot,
    });
    for (const cell of cells) {
      occupiedCells.add(`${cell.x},${cell.y}`);
    }
  }

  const baselineErrorIds = new Set(
    validateBuild({
      state,
      itemsById,
      gridW: GRID_W,
      gridH: GRID_H,
    }).issues
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.id),
  );

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    const ringCandidates = getRingCandidates(roundedStart, radius);
    for (const candidate of ringCandidates) {
      const candidateCells = getOccupiedCells({
        anchor: candidate,
        shapeCells: item.shape.cells,
        pivot: item.shape.pivot,
        rot,
      });

      const isOutOfBounds = candidateCells.some((cell) => !inBounds(cell.x, cell.y));
      if (isOutOfBounds) {
        continue;
      }

      const overlapsPlaced = candidateCells.some((cell) =>
        occupiedCells.has(`${cell.x},${cell.y}`),
      );
      if (overlapsPlaced) {
        continue;
      }

      const intersectsHero = candidateCells.some((cell) =>
        isHeroCell(cell.x, cell.y, heroAnchor),
      );
      if (intersectsHero) {
        continue;
      }

      const previewState: BuildStateV1 = {
        ...state,
        placed: [
          ...state.placed,
          {
            instanceId: PREVIEW_INSTANCE_ID,
            itemId: item.id,
            x: candidate.x,
            y: candidate.y,
            rot,
          },
        ],
      };

      const previewErrors = validateBuild({
        state: previewState,
        itemsById,
        gridW: GRID_W,
        gridH: GRID_H,
      }).issues.filter((issue) => issue.level === "error");
      const hasNewError = previewErrors.some((issue) => !baselineErrorIds.has(issue.id));
      if (hasNewError) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}
