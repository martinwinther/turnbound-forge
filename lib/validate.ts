import { toIndex } from "@/lib/grid";
import { getOccupiedCells } from "@/lib/polyomino";
import type { BuildStateV1, Item } from "@/lib/types";

export type ValidationLevel = "error" | "warning";

export type ValidationIssue = {
  id: string;
  level: ValidationLevel;
  message: string;
  instanceId?: string;
  cells?: Array<{ x: number; y: number }>;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  illegal: boolean;
  weaponCap: number;
  weaponCount: number;
};

type ValidateBuildArgs = {
  state: BuildStateV1;
  itemsById: Record<string, Item>;
  gridW: number;
  gridH: number;
};

const inBounds = (x: number, y: number, w: number, h: number): boolean =>
  x >= 0 && x < w && y >= 0 && y < h;

export function validateBuild({
  state,
  itemsById,
  gridW,
  gridH,
}: ValidateBuildArgs): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { placed, unlocked, trinkets } = state;

  let weaponCap = 3;
  for (const t of trinkets) {
    const item = itemsById[t.itemId];
    if (item?.modifiers?.weaponCapBonus != null) {
      weaponCap += item.modifiers.weaponCapBonus;
    }
  }
  weaponCap = Math.min(weaponCap, 4);

  let weaponCount = 0;
  for (const p of placed) {
    const item = itemsById[p.itemId];
    if (item?.category === "weapon") weaponCount += 1;
  }

  if (weaponCount > weaponCap) {
    issues.push({
      id: "weapon-cap",
      level: "error",
      message: `Weapon cap exceeded: ${weaponCount} weapons, cap is ${weaponCap}.`,
    });
  }

  const instanceCells = new Map<string, Array<{ x: number; y: number }>>();
  const cellToInstances = new Map<string, string[]>();

  for (const tile of placed) {
    const item = itemsById[tile.itemId];

    if (!item) {
      issues.push({
        id: `missing-item-${tile.instanceId}`,
        level: "warning",
        message: `Placed item "${tile.itemId}" not found in catalog.`,
        instanceId: tile.instanceId,
      });
      continue;
    }

    const cells = getOccupiedCells({
      anchor: { x: tile.x, y: tile.y },
      shapeCells: item.shape.cells,
      pivot: item.shape.pivot,
      rot: tile.rot,
    });
    instanceCells.set(tile.instanceId, cells);

    const outOfBoundsCells = cells.filter(
      (c) => !inBounds(c.x, c.y, gridW, gridH),
    );
    const inBoundsCells = cells.filter((c) =>
      inBounds(c.x, c.y, gridW, gridH),
    );

    if (outOfBoundsCells.length > 0) {
      issues.push({
        id: `out-of-bounds-${tile.instanceId}`,
        level: "error",
        message: `Tile extends out of bounds.`,
        instanceId: tile.instanceId,
        cells: inBoundsCells.length > 0 ? inBoundsCells : undefined,
      });
    }

    for (const cell of inBoundsCells) {
      const index = toIndex(cell.x, cell.y);
      if (!unlocked.includes(index)) {
        issues.push({
          id: `locked-cell-${tile.instanceId}-${index}`,
          level: "warning",
          message: `Tile uses locked cell (${cell.x}, ${cell.y}).`,
          instanceId: tile.instanceId,
          cells: [cell],
        });
      }

      const key = `${cell.x},${cell.y}`;
      const list = cellToInstances.get(key) ?? [];
      list.push(tile.instanceId);
      cellToInstances.set(key, list);
    }
  }

  const overlapCells = new Set<string>();
  for (const [, instanceIds] of cellToInstances) {
    if (instanceIds.length > 1) {
      for (const iid of instanceIds) {
        overlapCells.add(iid);
      }
    }
  }

  for (const tile of placed) {
    if (overlapCells.has(tile.instanceId)) {
      const cells = instanceCells.get(tile.instanceId) ?? [];
      const inGrid = cells.filter((c) =>
        inBounds(c.x, c.y, gridW, gridH),
      );
      issues.push({
        id: `overlap-${tile.instanceId}`,
        level: "error",
        message: "Tile overlaps another tile.",
        instanceId: tile.instanceId,
        cells: inGrid.length > 0 ? inGrid : undefined,
      });
    }
  }

  const uniqueItemCount = new Map<string, number>();
  for (const tile of placed) {
    const item = itemsById[tile.itemId];
    if (item?.isUnique) {
      uniqueItemCount.set(
        tile.itemId,
        (uniqueItemCount.get(tile.itemId) ?? 0) + 1,
      );
    }
  }
  for (const [itemId, count] of uniqueItemCount) {
    if (count > 1) {
      const item = itemsById[itemId];
      issues.push({
        id: `unique-duplicate-${itemId}`,
        level: "error",
        message: `Unique item "${item?.name ?? itemId}" is placed ${count} times.`,
      });
    }
  }

  const hasError = issues.some((i) => i.level === "error");
  return {
    issues,
    illegal: hasError,
    weaponCap,
    weaponCount,
  };
}
