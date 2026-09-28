export const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  dailyGoal: 120,
  notifications: true,
  sound: true,
  closeToTray: true,
};
export function settingsInput(input) {
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, min, max] of [
    ["focusMinutes", 1, 180],
    ["shortMinutes", 1, 60],
    ["longMinutes", 1, 120],
    ["dailyGoal", 1, 1440],
  ]) {
    const n = Number(input[key]);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`${key} 超出有效范围 ${min}–${max}`);
    result[key] = n;
  }
  for (const key of ["notifications", "sound", "closeToTray"])
    result[key] = !!input[key];
  return result;
}
