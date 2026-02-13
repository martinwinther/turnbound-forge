export type ItemCategory =
  | "hero"
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "trinket";

export const ITEM_CATEGORIES: ItemCategory[] = [
  "hero",
  "weapon",
  "armor",
  "accessory",
  "consumable",
  "trinket",
];

export type Rotation = 0 | 90 | 180 | 270;

export type Point = {
  x: number;
  y: number;
};

export type ItemShape = {
  cells: Array<[number, number]>;
  pivot: [number, number];
  rotatable: boolean;
};

export type Item = {
  id: string;
  name: string;
  category: ItemCategory;
  tags: string[];
  shape: ItemShape;
  rulesText: string;
  icon: string;
  isUnique?: boolean;
};

export type BuildStateV1 = {
  v: 1;
  heroId?: string;
  unlocked: number[];
  placed: Array<{
    instanceId: string;
    itemId: string;
    x: number;
    y: number;
    rot: Rotation;
    level?: 1 | 2 | 3;
  }>;
  trinkets: Array<{
    slot: 0 | 1 | 2;
    half: 0 | 1;
    itemId: string;
  }>;
};
