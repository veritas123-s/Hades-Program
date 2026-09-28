import { dayKey } from "./dates.mjs";
export function dayTotals(logs) {
  const result = {};
  for (const log of logs.filter((x) => !x.deletedAt))
    for (const segment of log.segments) {
      let cursor = segment.start;
      while (cursor < segment.end) {
        const d = new Date(cursor);
        d.setHours(24, 0, 0, 0);
        const end = Math.min(segment.end, +d),
          key = dayKey(cursor);
        result[key] = (result[key] || 0) + end - cursor;
        cursor = end;
      }
    }
  return result;
}
export function csvLogs(logs) {
  const cell = (value) =>
    `"${String(value ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  const rows = [
    ["任务", "清单", "开始时间", "结束时间", "工作分钟", "方式", "完成番茄"],
  ];
  for (const l of logs.filter((x) => !x.deletedAt))
    rows.push([
      l.title,
      l.project,
      new Date(l.startedAt).toLocaleString("sv-SE"),
      new Date(l.endedAt).toLocaleString("sv-SE"),
      (l.durationMs / 60000).toFixed(2),
      l.mode,
      l.completed ? "是" : "否",
    ]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
