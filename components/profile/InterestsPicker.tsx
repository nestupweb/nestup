"use client";

import { ChipPicker } from "@/components/profile/ChipPicker";
import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export function InterestsPicker({ initial }: { initial: string[] }) {
  return (
    <ChipPicker
      name="interests"
      options={INTERESTS}
      initial={initial}
      max={MAX_INTERESTS}
      legend={`Pick ${MIN_INTERESTS}–${MAX_INTERESTS}`}
    />
  );
}
