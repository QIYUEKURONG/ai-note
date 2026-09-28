"use client";

import type { PetMood } from "./useCompanion";
import type { PetKind } from "./pets";

export function PetFigure(props: { mood: PetMood; kind?: PetKind }) {
  const kind = props.kind ?? "round";
  return (
    <svg className={`pet-figure is-${props.mood} is-${kind}`} viewBox="0 0 140 128" aria-hidden="true">
      <ellipse className="pet-shadow" cx="70" cy="116" rx="28" ry="6" />
      {kind === "cat" ? <Cat /> : null}
      {kind === "bird" ? <Bird /> : null}
      {kind === "dumpling" ? <Dumpling /> : null}
      {kind === "round" ? <Round /> : null}
    </svg>
  );
}

function Round() {
  return (
    <>
      <path className="pet-tail" d="M102 78c16 2 24 14 20 24" />
      <ellipse className="pet-body" cx="70" cy="74" rx="36" ry="32" />
      <ellipse className="pet-belly" cx="70" cy="84" rx="20" ry="16" />
      <path className="pet-ear" d="M42 48 34 22c8 2 16 8 18 18z" />
      <path className="pet-ear" d="M98 48 106 22c-8 2-16 8-18 18z" />
      <Face cx={57.5} />
    </>
  );
}

function Cat() {
  return (
    <>
      <path className="pet-tail" d="M104 84c18-8 28 6 18 20" />
      <ellipse className="pet-body" cx="70" cy="78" rx="34" ry="28" />
      <ellipse className="pet-belly" cx="70" cy="86" rx="16" ry="12" />
      <path className="pet-ear" d="M40 58 28 24l28 16z" />
      <path className="pet-ear" d="M100 58 112 24 84 40z" />
      <path className="pet-mouth" d="M38 78h14M88 78h14M44 86h8M88 86h8" />
      <Face cx={57.5} />
    </>
  );
}

function Bird() {
  return (
    <>
      <ellipse className="pet-body" cx="68" cy="78" rx="32" ry="26" />
      <ellipse className="pet-belly" cx="74" cy="86" rx="16" ry="12" />
      <path className="pet-ear" d="M58 56c-2-16 10-22 16-8" />
      <path className="pet-tail" d="M38 74c-16 4-18 16-8 18" />
      <path className="pet-beak" d="M98 74l16 6-16 6z" />
      <ellipse className="pet-eye" cx="84" cy="70" rx="5.5" ry="6.5" />
      <ellipse className="pet-pupil" cx="86" cy="72" rx="2" ry="2.4" />
      <path className="pet-mouth" d="M104 92c6 4 2 8-2 6" />
      <circle className="pet-cheek" cx="74" cy="82" r="4" />
    </>
  );
}

function Dumpling() {
  return (
    <>
      <ellipse className="pet-body" cx="70" cy="78" rx="40" ry="30" />
      <path className="pet-ear" d="M70 50c2-16 8-16 8 0" />
      <ellipse className="pet-belly" cx="70" cy="86" rx="18" ry="12" />
      <Face cx={56} />
    </>
  );
}

function Face(props: { cx: number }) {
  const left = props.cx;
  const right = props.cx + 27;
  return (
    <>
      <ellipse className="pet-eye" cx={left - 1.5} cy="70" rx="5.5" ry="6.5" />
      <ellipse className="pet-eye" cx={right - 1.5} cy="70" rx="5.5" ry="6.5" />
      <ellipse className="pet-pupil" cx={left} cy="72" rx="2" ry="2.4" />
      <ellipse className="pet-pupil" cx={right} cy="72" rx="2" ry="2.4" />
      <path className="pet-mouth" d={`M${left + 4} 86c4 5 12 5 16 0`} />
      <circle className="pet-cheek" cx={left - 12} cy="82" r="4" />
      <circle className="pet-cheek" cx={right + 10} cy="82" r="4" />
    </>
  );
}
