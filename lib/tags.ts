import type { BuildStateV1, Item } from "@/lib/types";

type GetActiveTagsArgs = {
  state: BuildStateV1;
  itemsById: Record<string, Item>;
};

type RankedItem = {
  item: Item;
  overlap: number;
  shared: string[];
};

type RankItemsBySynergyOptions = {
  excludePlaced?: boolean;
  placedItemIds?: Set<string>;
};

type CountedTrinket = {
  itemId: string;
};

const collectCountedTrinketsForTags = (
  trinkets: BuildStateV1["trinkets"],
  itemsById: Record<string, Item>,
): CountedTrinket[] => {
  const counted: CountedTrinket[] = [];
  const visitedHalves = new Set<string>();

  for (const entry of trinkets) {
    const halfKey = `${entry.slot}-${entry.half}`;
    if (visitedHalves.has(halfKey)) {
      continue;
    }

    const item = itemsById[entry.itemId];
    const otherHalf = entry.half === 0 ? 1 : 0;
    const other = trinkets.find(
      (candidate) =>
        candidate.slot === entry.slot &&
        candidate.half === otherHalf &&
        candidate.itemId === entry.itemId,
    );

    if (item?.isHalfTrinket) {
      counted.push({
        itemId: entry.itemId,
      });
      visitedHalves.add(halfKey);
      continue;
    }

    if (other) {
      counted.push({
        itemId: entry.itemId,
      });
      visitedHalves.add(`${entry.slot}-0`);
      visitedHalves.add(`${entry.slot}-1`);
      continue;
    }

    counted.push({
      itemId: entry.itemId,
    });
    visitedHalves.add(halfKey);
  }

  return counted;
};

export const getActiveTags = ({ state, itemsById }: GetActiveTagsArgs): string[] => {
  const tagSet = new Set<string>();

  for (const placed of state.placed) {
    const item = itemsById[placed.itemId];
    if (!item) {
      continue;
    }
    for (const tag of item.tags) {
      tagSet.add(tag);
    }
  }

  const countedTrinkets = collectCountedTrinketsForTags(state.trinkets, itemsById);
  for (const counted of countedTrinkets) {
    const item = itemsById[counted.itemId];
    if (!item) {
      continue;
    }
    for (const tag of item.tags) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort();
};

export const getItemTagOverlap = (item: Item, active: Set<string>): number => {
  let overlap = 0;
  for (const tag of item.tags) {
    if (active.has(tag)) {
      overlap += 1;
    }
  }
  return overlap;
};

export const rankItemsBySynergy = (
  items: Item[],
  activeTags: string[],
  opts?: RankItemsBySynergyOptions,
): RankedItem[] => {
  if (activeTags.length === 0 || items.length === 0) {
    return [];
  }

  const activeSet = new Set(activeTags);
  const placedItemIds =
    opts?.excludePlaced !== false ? opts?.placedItemIds ?? new Set<string>() : undefined;

  const ranked: RankedItem[] = [];

  for (const item of items) {
    if (placedItemIds && placedItemIds.has(item.id)) {
      continue;
    }

    const shared = item.tags.filter((tag) => activeSet.has(tag));
    if (shared.length === 0) {
      continue;
    }

    ranked.push({
      item,
      overlap: shared.length,
      shared,
    });
  }

  ranked.sort((a, b) => {
    if (b.overlap !== a.overlap) {
      return b.overlap - a.overlap;
    }
    return a.item.name.localeCompare(b.item.name);
  });

  return ranked;
};

