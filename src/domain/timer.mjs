import { uid } from "./dates.mjs";
import { DEFAULT_SETTINGS } from "./settings.mjs";
export function emptyTimer(settings = DEFAULT_SETTINGS, mode = "focus") {
  return {
    mode,
    status: "idle",
    taskId: "",
    taskTitle: "",
    project: "未分类",
    targetMs:
      (mode === "focus"
        ? settings.focusMinutes
        : mode === "short"
          ? settings.shortMinutes
          : mode === "long"
            ? settings.longMinutes
            : 0) * 60000,
    startedAt: null,
    activeSince: null,
    checkpointAt: null,
    segments: [],
  };
}
export function elapsed(timer, now = Date.now()) {
  return (
    timer.segments.reduce((n, s) => n + Math.max(0, s.end - s.start), 0) +
    (timer.status === "running" ? Math.max(0, now - timer.activeSince) : 0)
  );
}
function seal(timer, now) {
  if (timer.status === "running" && now > timer.activeSince)
    timer.segments.push({ start: timer.activeSince, end: now });
  timer.activeSince = null;
}
export function finishTimer(state, now = Date.now(), completed = false) {
  const t = state.timer;
  if (t.status === "idle") return;
  let end = now;
  if (completed && t.status === "running" && t.targetMs)
    end =
      t.activeSince +
      Math.max(0, t.targetMs - elapsed({ ...t, status: "paused" }, now));
  seal(t, end);
  t.status = "paused";
  const total = t.segments.reduce((n, s) => n + s.end - s.start, 0);
  if (["focus", "stopwatch"].includes(t.mode) && total >= 1000)
    state.logs.push({
      id: uid(),
      taskId: t.taskId,
      title: t.taskTitle || "自由专注",
      project: t.project,
      mode: t.mode,
      startedAt: t.startedAt,
      endedAt: end,
      durationMs: total,
      completed,
      segments: t.segments,
      deletedAt: null,
    });
  if (completed && t.mode === "focus") state.cycles++;
  const nextMode =
    completed && t.mode === "focus"
      ? state.cycles % 4 === 0
        ? "long"
        : "short"
      : completed && ["short", "long"].includes(t.mode)
        ? "focus"
        : t.mode;
  state.timer = emptyTimer(state.settings, nextMode);
  return { completed, mode: t.mode, durationMs: total, nextMode };
}
export function timerAction(state, action, payload = {}, now = Date.now()) {
  const t = state.timer;
  if (action === "start") {
    if (t.status === "running") return;
    if (t.status === "idle") {
      const mode = ["focus", "short", "long", "stopwatch"].includes(
        payload.mode,
      )
        ? payload.mode
        : t.mode;
      state.timer = emptyTimer(state.settings, mode);
      if (payload.durationMinutes !== undefined && mode !== "stopwatch") {
        const minutes = Number(payload.durationMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)
          throw new Error("本次时长应为 1–180 分钟的整数");
        state.timer.targetMs = minutes * 60000;
      }
      const task = state.tasks.find(
        (x) => x.id === payload.taskId && !x.deletedAt && !x.completedAt,
      );
      Object.assign(state.timer, {
        taskId: task?.id || "",
        taskTitle: task?.title || "",
        project: task?.project || "未分类",
        startedAt: now,
      });
    }
    Object.assign(state.timer, {
      status: "running",
      activeSince: now,
      checkpointAt: now,
    });
  } else if (action === "pause") {
    if (t.status === "running") {
      seal(t, now);
      t.status = "paused";
      t.checkpointAt = now;
    }
  } else if (action === "finish") return finishTimer(state, now, false);
  else if (action === "reset") state.timer = emptyTimer(state.settings, t.mode);
  else throw new Error("不支持的计时操作");
}
export function recoverTimer(state) {
  if (state.timer.status === "running") {
    timerAction(
      state,
      "pause",
      {},
      state.timer.checkpointAt || state.timer.activeSince,
    );
    state.lastNotice = "上次计时已暂停，已保留最近保存的工作时长。";
  }
}
export function tickTimer(state, now = Date.now()) {
  if (state.timer.status !== "running") return null;
  state.timer.checkpointAt = now;
  if (state.timer.targetMs && elapsed(state.timer, now) >= state.timer.targetMs)
    return finishTimer(state, now, true);
  return null;
}
