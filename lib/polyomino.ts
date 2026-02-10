import type { Rotation } from "@/lib/types";

export type Cell = {
  x: number;
  y: number;
};

export const rotatePoint = (
  dx: number,
  dy: number,
  rot: Rotation,
): { x: number; y: number } => {
  switch (rot) {
    case 0:
      return { x: dx, y: dy };
    case 90:
      return { x: -dy, y: dx };
    case 180:
      return { x: -dx, y: -dy };
    case 270:
      return { x: dy, y: -dx };
    default:
      return { x: dx, y: dy };
  }
};

export const normalizeCells = (
  cells: Array<[number, number]>,
): Array<[number, number]> => {
  if (cells.length === 0) {
    return [];
  }

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  return cells.map(([x, y]) => [x - minX, y - minY]);
};

type GetOccupiedCellsArgs = {
  anchor: Cell;
  shapeCells: Array<[number, number]>;
  pivot?: [number, number];
  rot: Rotation;
};

export const getOccupiedCells = ({
  anchor,
  shapeCells,
  pivot = [0, 0],
  rot,
}: GetOccupiedCellsArgs): Cell[] => {
  const [pivotX, pivotY] = pivot;

  return shapeCells.map(([cellX, cellY]) => {
    const translatedX = cellX - pivotX;
    const translatedY = cellY - pivotY;
    const rotated = rotatePoint(translatedX, translatedY, rot);

    return {
      x: anchor.x + pivotX + rotated.x,
      y: anchor.y + pivotY + rotated.y,
    };
  });
};

export const getBoundingBox = (
  cells: Cell[],
): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } => {
  if (cells.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  }

  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
};

export const createPolyominoDemo = () => {
  const shape: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ];

  const anchor = { x: 3, y: 3 };
  const pivot: [number, number] = [1, 0];

  return {
    normalizedShape: normalizeCells(shape),
    occupiedAt0: getOccupiedCells({ anchor, shapeCells: shape, pivot, rot: 0 }),
    occupiedAt90: getOccupiedCells({ anchor, shapeCells: shape, pivot, rot: 90 }),
    occupiedAt180: getOccupiedCells({ anchor, shapeCells: shape, pivot, rot: 180 }),
    occupiedAt270: getOccupiedCells({ anchor, shapeCells: shape, pivot, rot: 270 }),
  };
};
