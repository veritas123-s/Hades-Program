export const text = (v, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
