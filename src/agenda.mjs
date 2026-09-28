import { learningSelection } from "./learning-policy.mjs";
import { beijingDay, buildFeed } from "./briefing.mjs";
export function deadlineMs(task) {
  return task.due
    ? Date.parse(`${task.due}T${task.dueTime || "23:59"}:00+08:00`)
    : Infinity;
}
export function learningEntries(
  state,
  learning = {},
  { deleted = false, history = false, now = Date.now() } = {},
) {
  const selection = learningSelection(state, learning, now);
  return selection[deleted ? "deleted" : history ? "history" : "current"].map(
    (x) => ({
      ...x,
      id: `learning:${x.id}:${x.estimated ? "estimate" : x.deadline || ""}`,
      sourceId: x.id,
      kind: x.kind === "notice" ? "notice" : "assignment",
      subtitle: x.course,
      time: x.deadline || x.publishedAt || x.updatedAt || 0,
      label:
        x.kind === "notice"
          ? "超星通知"
          : x.deadline
            ? "作业截止"
            : "截止时间待核对",
    }),
  );
}
export function agenda(state, learning = {}, now = Date.now()) {
  const today = beijingDay(now),
    feed = buildFeed(state, now);
  const selection = learningSelection(state, learning, now);
  const suppressed = new Set(
    [...selection.history, ...selection.deleted]
      .filter((x) => x.kind === "assignment")
      .map((x) => x.taskId)
      .filter(Boolean),
  );
  const active = state.tasks.filter(
    (t) => !t.completedAt && !t.deletedAt && !suppressed.has(t.id),
  );
  const tasks = active
    .filter((t) => t.due && deadlineMs(t) <= now + 3 * 86400000)
    .map((t) => ({
      id: `task:${t.id}:${t.due}:${t.dueTime}`,
      taskId: t.id,
      kind: "task",
      title: t.title,
      subtitle: t.project,
      time: deadlineMs(t),
      label:
        deadlineMs(t) < now
          ? "已逾期"
          : t.due === today
            ? "今日截止"
            : "即将到期",
    }));
  const courses = (feed.timetable.courses[today] || [])
    .map((c, i) => ({
      id: `course:${today}:${i}:${c.start}`,
      kind: "course",
      title: c.name,
      subtitle: `${c.start}–${c.end} ${c.room}`,
      time: Date.parse(`${today}T${c.start}:00+08:00`),
      label: "今日课程",
    }))
    .sort((a, b) => a.time - b.time);
  const external = learningEntries(state, learning, { now });
  const linkedIds = new Set(
    external.filter((x) => x.kind === "assignment").map((x) => x.taskId),
  );
  const entries = [
    ...tasks.filter((t) => !linkedIds.has(t.taskId)),
    ...courses,
    ...external,
  ].sort((a, b) =>
    a.kind === "notice" && b.kind === "notice"
      ? b.time - a.time
      : a.kind === "notice"
        ? 1
        : b.kind === "notice"
          ? -1
          : a.time - b.time,
  );
  const currentCourse = courses.find((c) => {
    const raw = (feed.timetable.courses[today] || []).find(
      (r) => r.name === c.title && c.subtitle.startsWith(r.start),
    );
    return c.time <= now && Date.parse(`${today}T${raw?.end}:00+08:00`) > now;
  });
  const nextCourse = courses.find((c) => c.time > now);
  const gap = nextCourse
    ? Math.floor((nextCourse.time - now) / 60000) - 5
    : 180;
  const ranked = active.toSorted((a, b) => {
    const score = (t) =>
      (deadlineMs(t) < now ? 1000 : deadlineMs(t) < now + 86400000 ? 500 : 0) +
      ({ do: 150, plan: 80, delegate: 30, later: 0 }[t.quadrant] || 0) +
      (t.estimate > 0 && t.estimate <= gap ? 40 : 0) -
      Math.min(100, (deadlineMs(t) - now) / 86400000);
    return (
      score(b) - score(a) ||
      deadlineMs(a) - deadlineMs(b) ||
      a.createdAt - b.createdAt
    );
  });
  const task = ranked[0];
  const recommendation =
    state.timer.status !== "idle"
      ? {
          title: "继续当前专注",
          reason: state.timer.taskTitle || "当前计时尚未结束",
          action: "focus",
        }
      : currentCourse
        ? {
            title: `现在是 ${currentCourse.title}`,
            reason: currentCourse.subtitle,
            action: "campus",
          }
        : gap < 10
          ? {
              title: "准备下一节课",
              reason: nextCourse.title + " · " + nextCourse.subtitle,
              action: "campus",
            }
          : task
            ? {
                title: task.title,
                reason: `${task.due ? `${task.due} ${task.dueTime || "当天"} 截止` : "按四象限优先级"}${nextCourse ? ` · 距下节课约 ${gap + 5} 分钟` : ""}`,
                action: "start",
                taskId: task.id,
                minutes: Math.max(
                  1,
                  Math.min(
                    state.settings.focusMinutes,
                    gap,
                    task.estimate || 180,
                  ),
                ),
              }
            : {
                title: "暂时没有待办",
                reason: "添加任务，或检查尚未同步的课程和作业。",
                action: "tasks",
              };
  return {
    today,
    entries,
    recommendation,
    courseVerified: feed.timetable.verified_dates.includes(today),
  };
}
export function selectModel({
  defaultModel,
  models = [],
  mode = "auto",
  text = "",
}) {
  if (mode === "default") return defaultModel;
  if (mode !== "auto") {
    if (mode !== defaultModel && !models.includes(mode))
      throw new Error("所选模型不在当前服务列表中");
    return mode;
  }
  const pattern = /代码|编程|debug|typescript|python|javascript/i.test(text)
    ? /coder|coding/i
    : /推理|证明|复杂|规划|计划|优先级|先做什么/.test(text)
      ? /reasoner|reasoning|glm-5/i
      : null;
  return (pattern && models.find((x) => pattern.test(x))) || defaultModel;
}
