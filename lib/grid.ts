export const GRID_W = 7;
export const GRID_H = 7;

export const HERO_START = { x: 3, y: 3 };

export const toIndex = (x: number, y: number): number => y * GRID_W + x;

export const fromIndex = (index: number): { x: number; y: number } => ({
  x: index % GRID_W,
  y: Math.floor(index / GRID_W),
});

export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;

export const isStartUnlocked = (x: number, y: number): boolean => {
  const isUnlockedRow = y >= 2 && y <= 4;
  const isUnlockedCol = x >= 1 && x <= 5;
  return isUnlockedRow && isUnlockedCol;
};

export const getStartUnlockedIndices = (): number[] => {
  const indices: number[] = [];
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (isStartUnlocked(x, y)) {
        indices.push(toIndex(x, y));
      }
    }
  }
  return indices;
};
