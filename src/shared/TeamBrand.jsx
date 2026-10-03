import React from "react";
import artwork from "../../assets/medtrix-wordmark-transparent.png";

export default function TeamBrand({ compact = false }) {
  return (
    <img
      className={`team-brand${compact ? " team-brand-compact" : ""}`}
      src={artwork}
      alt="Medtrix 团队"
    />
  );
}
