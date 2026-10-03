export function refreshRemaining(shared, now = Date.now()) {
  if (!shared || !Number.isFinite(shared.nextRunAt) || !Number.isFinite(shared.serverNow) || !Number.isFinite(shared.receivedAt)) return null;
  return Math.max(0, Math.ceil((shared.nextRunAt - shared.serverNow - (now - shared.receivedAt)) / 1000));
}
export function refreshLabel(shared, now = Date.now()) {
  const seconds = refreshRemaining(shared, now);
  if (seconds === null) return "等待服务器刷新计划";
  if (shared.busy) return "服务器正在采集";
  if (seconds === 0) return "等待服务器刷新结果";
  return `距下次刷新 ${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
