import React from "react";
export default function BrandMark() {
  return (
    <svg
      className="brand-symbol medstack-mark"
      viewBox="96 96 320 320"
      role="img"
      aria-label="Medstack"
    >
      <path d="M128 190 256 120 384 190 256 260Z" fill="currentColor" />
      <path
        d="m128 254 128 70 128-70"
        fill="none"
        stroke="var(--green)"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m128 322 128 70 128-70"
        fill="none"
        stroke="currentColor"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M207 200v-32l49 27 49-27v32"
        fill="none"
        stroke="var(--surface)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
