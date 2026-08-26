"use client";

import { ChipPicker } from "@/components/profile/ChipPicker";
import { CHORES } from "@/lib/constants";

/** Household chores I'm happy to take on — shown on my profile as chips. */
export function ChoresPicker({ initial }: { initial: string[] }) {
  return <ChipPicker name="chores" options={CHORES} initial={initial} legend="Happy to take on" />;
}
