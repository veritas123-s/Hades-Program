import React from "react";
import artwork from "../../assets/medtrix-brand.png";

export default function TeamBrand({ compact = false }) {
  return (
    <svg
      className={`team-brand${compact ? " team-brand-compact" : ""}`}
      viewBox="80 475 1100 295"
      role="img"
      aria-label="Medtrix 团队"
    >
      <image href={artwork} width="1254" height="1254" />
    </svg>
  );
}
