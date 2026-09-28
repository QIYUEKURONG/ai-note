export const PETS = [
  { id: "round", label: "圆圆" },
  { id: "cat", label: "猫猫" },
  { id: "bird", label: "小鸟" },
  { id: "dumpling", label: "团子" },
] as const;

export type PetKind = (typeof PETS)[number]["id"];

export function asPetKind(value: string | null | undefined): PetKind {
  return PETS.some((pet) => pet.id === value) ? (value as PetKind) : "round";
}
