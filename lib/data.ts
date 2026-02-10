import rawItems from "@/data/items.json";
import rawTrinkets from "@/data/trinkets.json";
import type { Item } from "@/lib/types";

export const items: Item[] = rawItems as Item[];

export const itemsById: Record<string, Item> = items.reduce<Record<string, Item>>(
  (accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  },
  {},
);

export const trinkets: Item[] = rawTrinkets as Item[];

export const trinketsById: Record<string, Item> = trinkets.reduce<
  Record<string, Item>
>((accumulator, item) => {
  accumulator[item.id] = item;
  return accumulator;
}, {});
