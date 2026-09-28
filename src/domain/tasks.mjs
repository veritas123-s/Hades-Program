import { uid, dayKey, validDay, addDays } from "./dates.mjs";
import { text } from "./text.mjs";
export const QUADRANTS = [
  { id: "do", title: "立即行动", subtitle: "重要且紧急", color: "#b45646" },
  { id: "plan", title: "专注规划", subtitle: "重要不紧急", color: "#74846b" },
  {
    id: "delegate",
    title: "高效处理",
    subtitle: "紧急不重要",
    color: "#bb9254",
  },
  {
    id: "later",
    title: "留待以后",
    subtitle: "不重要不紧急",
    color: "#8d879e",
  },
];
export function taskInput(input, existing = {}) {
  const title = text(input.title);
  if (!title) throw new Error("请填写任务名称");
  if (!QUADRANTS.some((q) => q.id === input.quadrant))
    throw new Error("请选择任务象限");
  const due = input.due || "";
  if (due && !validDay(due)) throw new Error("截止日期无效");
  const dueTime = input.dueTime || "";
  if (dueTime && (!due || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)))
    throw new Error("请先选择截止日期，并填写有效截止时间");
  const reminder = input.reminder || "";
  if (
    reminder &&
    (!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(reminder) ||
      !validDay(reminder.slice(0, 10)) ||
      !Number.isFinite(Date.parse(reminder)))
  )
    throw new Error("提醒时间无效");
  const estimate = Number(input.estimate || 0);
  if (!Number.isFinite(estimate) || estimate < 0 || estimate > 10000)
    throw new Error("预计时间应为 0–10000 分钟");
  const subtasks = (Array.isArray(input.subtasks) ? input.subtasks : [])
    .slice(0, 100)
    .map((s) => ({
      id: text(s.id) || uid(),
      title: text(s.title),
      done: !!s.done,
    }))
    .filter((s) => s.title);
  return {
    id: existing.id || uid(),
    title,
    quadrant: input.quadrant,
    project: text(input.project, 60) || "收集箱",
    due,
    dueTime,
    reminder,
    repeat: ["daily", "weekly"].includes(input.repeat) ? input.repeat : "none",
    estimate,
    notes: text(input.notes, 10000),
    subtasks,
    createdAt: existing.createdAt || Date.now(),
    completedAt: existing.completedAt || null,
    deletedAt: existing.deletedAt || null,
    remindedFor:
      reminder === existing.reminder ? existing.remindedFor || "" : "",
  };
}
export function completeTask(state, id, now = Date.now()) {
  const task = state.tasks.find((t) => t.id === id && !t.deletedAt);
  if (!task) throw new Error("任务不存在");
  if (task.completedAt) {
    task.completedAt = null;
    return;
  }
  task.completedAt = now;
  if (task.repeat === "none") return;
  const step = task.repeat === "daily" ? 1 : 7;
  let due = task.due || dayKey(now);
  do {
    due = addDays(due, step);
  } while (due <= dayKey(now));
  const next = taskInput({
    ...task,
    due,
    reminder: task.reminder ? `${due}T${task.reminder.slice(11)}` : "",
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
  });
  next.repeatParent = task.id;
  // Reopening then re-completing does not generate duplicate occurrences.
  if (!state.tasks.some((t) => t.repeatParent === task.id))
    state.tasks.push(next);
}
