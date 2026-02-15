"use client";

import { useMemo, useState } from "react";

import type { BuildStateV1, Item } from "@/lib/types";

type TrinketSlotsProps = {
  trinkets: BuildStateV1["trinkets"];
  onAdd: (slot: 0 | 1 | 2, half: 0 | 1, itemId: string) => void;
  onRemove: (slot: 0 | 1 | 2, half: 0 | 1) => void;
  availableTrinkets: Item[];
};

type SlotIndex = 0 | 1 | 2;
type HalfIndex = 0 | 1;
type PickerTarget = { slot: SlotIndex; half: HalfIndex } | null;

const slotIndexes: SlotIndex[] = [0, 1, 2];
const halfIndexes: HalfIndex[] = [0, 1];

const getSlotTrinkets = (
  trinkets: BuildStateV1["trinkets"],
  slot: SlotIndex,
): Partial<Record<HalfIndex, BuildStateV1["trinkets"][number]>> => {
  const slotEntries = trinkets.filter((entry) => entry.slot === slot);
  const half0 = slotEntries.find((entry) => entry.half === 0);
  const half1 = slotEntries.find((entry) => entry.half === 1);
  return { 0: half0, 1: half1 };
};

export const TrinketSlots = ({
  trinkets,
  onAdd,
  onRemove,
  availableTrinkets,
}: TrinketSlotsProps) => {
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const trinketsById = useMemo(() => {
    return availableTrinkets.reduce<Record<string, Item>>((accumulator, item) => {
      accumulator[item.id] = item;
      return accumulator;
    }, {});
  }, [availableTrinkets]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-800">Trinkets</h2>
        <p className="text-xs text-zinc-500">3 slots, 2 halves each.</p>
      </div>

      <div className="space-y-3">
        {slotIndexes.map((slot) => {
          const slotState = getSlotTrinkets(trinkets, slot);
          const left = slotState[0];
          const right = slotState[1];
          const leftItem = left ? trinketsById[left.itemId] : undefined;
          const fullOccupant =
            left != null &&
            right != null &&
            left.itemId === right.itemId &&
            !leftItem?.isHalfTrinket;

          return (
            <div
              key={slot}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5"
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Slot {slot + 1}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {fullOccupant ? (
                  <div className="col-span-2 flex items-center justify-between rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-violet-900">
                        {leftItem?.name ?? left.itemId}
                      </div>
                      <div className="text-[11px] text-violet-700">Full trinket</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(slot, 0)}
                      className="rounded border border-violet-300 bg-white px-2 py-0.5 text-xs font-semibold text-violet-700"
                      aria-label={`Remove ${leftItem?.name ?? left.itemId} from slot ${slot + 1}`}
                    >
                      x
                    </button>
                  </div>
                ) : (
                  halfIndexes.map((half) => {
                    const entry = slotState[half];
                    const item = entry ? trinketsById[entry.itemId] : undefined;
                    const otherHalf: HalfIndex = half === 0 ? 1 : 0;
                    const otherEntry = slotState[otherHalf];
                    const incompatibleState =
                      entry != null &&
                      otherEntry != null &&
                      entry.itemId === otherEntry.itemId &&
                      !item?.isHalfTrinket;

                    const allowOnlyHalf = otherEntry != null;
                    const pickerOpen =
                      pickerTarget?.slot === slot && pickerTarget?.half === half;
                    const options = availableTrinkets.filter((candidate) => {
                      if (allowOnlyHalf && !candidate.isHalfTrinket) {
                        return false;
                      }
                      if (
                        allowOnlyHalf &&
                        otherEntry &&
                        trinketsById[otherEntry.itemId]?.isHalfTrinket &&
                        candidate.id === otherEntry.itemId
                      ) {
                        return false;
                      }
                      return true;
                    });

                    return (
                      <div key={`${slot}-${half}`} className="space-y-1">
                        {entry ? (
                          <div className="flex min-h-14 items-start justify-between rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-zinc-800">
                                {item?.name ?? entry.itemId}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {item?.isHalfTrinket ? "Half" : "Full (invalid split)"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemove(slot, half)}
                              className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700"
                              aria-label={`Remove ${item?.name ?? entry.itemId} from slot ${slot + 1}`}
                            >
                              x
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPickerTarget((current) =>
                                current?.slot === slot && current?.half === half
                                  ? null
                                  : { slot, half },
                              )
                            }
                            className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-400"
                            title={
                              allowOnlyHalf
                                ? "Only half trinkets fit while the other half is occupied."
                                : "Add a trinket to this half."
                            }
                          >
                            + Empty
                          </button>
                        )}

                        {pickerOpen && !entry ? (
                          <div className="rounded-md border border-zinc-200 bg-white p-1.5">
                            <select
                              defaultValue=""
                              onChange={(event) => {
                                const selectedItemId = event.target.value;
                                if (!selectedItemId) {
                                  return;
                                }
                                onAdd(slot, half, selectedItemId);
                                setPickerTarget(null);
                              }}
                              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                            >
                              <option value="" disabled>
                                Select trinket...
                              </option>
                              {options.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                  {candidate.isHalfTrinket ? " (half)" : " (full)"}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}

                        {incompatibleState ? (
                          <p className="text-[11px] text-red-600">
                            Invalid slot state. Remove and re-add this trinket.
                          </p>
                        ) : null}

                        {!entry && allowOnlyHalf ? (
                          <p className="text-[11px] text-zinc-500">
                            Other half occupied, only half trinkets can be added.
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
