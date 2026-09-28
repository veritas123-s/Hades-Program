export const uid = () => globalThis.crypto.randomUUID();
export const dayKey = (value = Date.now()) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const validDay = (s) =>
  typeof s === "string" &&
  /^20\d{2}-\d{2}-\d{2}$/.test(s) &&
  dayKey(new Date(`${s}T12:00:00`)) === s;
export const addDays = (s, n) => {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const monday = (s) =>
  addDays(s, -((new Date(`${s}T12:00:00`).getDay() + 6) % 7));
