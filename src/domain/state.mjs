import { migrateData, CURRENT_DATA_VERSION } from "./migrations.mjs";
import { initialWorkspace, workspaceInput } from "../platform/model.mjs";
import { validDay } from "./dates.mjs";
import { text } from "./text.mjs";
import { DEFAULT_SETTINGS, settingsInput } from "./settings.mjs";
import { emptyTimer } from "./timer.mjs";
import { taskInput } from "./tasks.mjs";
import { contentInput } from "./content.mjs";
import { initialHub, validateHub } from "./workhub.mjs";
export function initialState() {
  return {
    schemaVersion: CURRENT_DATA_VERSION,
    workhub: initialHub(),
    workspace: initialWorkspace(),
    tasks: [],
    lists: [{ id: "list:收集箱", name: "收集箱", deletedAt: null }],
    events: [],
    courseTrash: [],
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
    timer: emptyTimer(),
    cycles: 0,
    courses: [],
    courseRanges: [],
    scores: null,
    lastNotice: "",
  };
}
export function validateState(raw) {
  raw = migrateData(raw);
  if (
    !raw ||
    raw.schemaVersion !== CURRENT_DATA_VERSION ||
    !Array.isArray(raw.tasks) ||
    !Array.isArray(raw.logs) ||
    raw.tasks.length > 50000 ||
    raw.logs.length > 100000
  )
    throw new Error("备份格式或版本不支持");
  const state = initialState();
  state.workhub = validateHub(raw.workhub);
  state.workspace = workspaceInput(raw.workspace);
  state.settings = settingsInput(raw.settings || {});
  const ids = new Set();
  state.tasks = raw.tasks.map((t) => {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      ids.has(t.id) ||
      !Number.isFinite(t.createdAt) ||
      t.createdAt < 0 ||
      (t.completedAt != null && !Number.isFinite(t.completedAt)) ||
      (t.deletedAt != null && !Number.isFinite(t.deletedAt))
    )
      throw new Error("任务标识或时间字段无效");
    ids.add(t.id);
    return {
      ...taskInput(t, t),
      repeatParent: text(t.repeatParent),
      remindedFor: text(t.remindedFor),
    };
  });
  const logIds = new Set();
  state.logs = raw.logs.map((l) => {
    if (
      !l ||
      typeof l.id !== "string" ||
      !l.id ||
      logIds.has(l.id) ||
      !Array.isArray(l.segments) ||
      !l.segments.length ||
      l.segments.length > 10000
    )
      throw new Error("工作记录损坏");
    logIds.add(l.id);
    let previous = 0;
    for (const s of l.segments) {
      if (
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start ||
        s.end - s.start > 366 * 86400000 ||
        s.start < previous
      )
        throw new Error("工作区间无效");
      previous = s.end;
    }
    return {
      id: text(l.id),
      taskId: text(l.taskId),
      title: text(l.title),
      project: text(l.project),
      mode: ["focus", "stopwatch", "manual"].includes(l.mode)
        ? l.mode
        : "manual",
      startedAt: l.segments[0]?.start || 0,
      endedAt: l.segments.at(-1)?.end || 0,
      durationMs: l.segments.reduce((n, s) => n + s.end - s.start, 0),
      completed: !!l.completed,
      segments: l.segments.map((s) => ({ start: s.start, end: s.end })),
      deletedAt: l.deletedAt || null,
    };
  });
  if (
    raw.timer &&
    ["idle", "paused", "running"].includes(raw.timer.status) &&
    ["focus", "short", "long", "stopwatch"].includes(raw.timer.mode)
  ) {
    const t = raw.timer;
    if (
      !Array.isArray(t.segments) ||
      t.segments.length > 10000 ||
      t.segments.some(
        (s) =>
          !Number.isFinite(s.start) ||
          !Number.isFinite(s.end) ||
          s.end < s.start ||
          s.start < 0 ||
          s.end - s.start > 366 * 86400000,
      ) ||
      !Number.isFinite(t.targetMs) ||
      t.targetMs < 0 ||
      t.targetMs > 180 * 60000 ||
      (t.status === "running" &&
        (!Number.isFinite(t.activeSince) || !Number.isFinite(t.checkpointAt)))
    )
      throw new Error("计时器状态损坏");
    state.timer = {
      mode: t.mode,
      status: t.status,
      taskId: text(t.taskId),
      taskTitle: text(t.taskTitle),
      project: text(t.project) || "未分类",
      targetMs: t.targetMs,
      startedAt: Number.isFinite(t.startedAt) ? t.startedAt : null,
      activeSince: t.status === "running" ? t.activeSince : null,
      checkpointAt: Number.isFinite(t.checkpointAt) ? t.checkpointAt : null,
      segments: t.segments.map((s) => ({ start: s.start, end: s.end })),
    };
  }
  state.cycles =
    Number.isSafeInteger(raw.cycles) && raw.cycles >= 0 ? raw.cycles : 0;
  state.courses = Array.isArray(raw.courses)
    ? raw.courses
        .filter(
          (c) =>
            c &&
            typeof c.title === "string" &&
            typeof c.start === "string" &&
            validDay(c.start.slice(0, 10)) &&
            typeof c.end === "string" &&
            c.end > c.start,
        )
        .map((c) => ({
          title: text(c.title),
          start: text(c.start, 40),
          end: text(c.end, 40),
          location: text(c.location),
          teacher: text(c.teacher),
          type: text(c.type),
          ids: Object.fromEntries(
            ["MCSID", "CSID", "CurriculumID", "XXKMID", "CurriculumType"].map(
              (k) => [k, text(String(c.ids?.[k] ?? ""), 100)],
            ),
          ),
        }))
    : [];
  state.courseRanges = Array.isArray(raw.courseRanges)
    ? raw.courseRanges.filter(
        (r) =>
          validDay(r.start) && validDay(r.end) && Number.isFinite(r.syncedAt),
      )
    : [];
  state.scores =
    raw.scores && Array.isArray(raw.scores.items)
      ? {
          year: text(raw.scores.year),
          semester: Number(raw.scores.semester) || 1,
          syncedAt: Number(raw.scores.syncedAt) || 0,
          years: Array.isArray(raw.scores.years)
            ? raw.scores.years.map((y) => text(y))
            : [],
          gpa: text(raw.scores.gpa, 2000),
          items: raw.scores.items
            .filter((x) => x && typeof x === "object")
            .map((x) =>
              Object.fromEntries(
                [
                  "title",
                  "score",
                  "finalScore",
                  "grade",
                  "credit",
                  "situation",
                ].map((k) => [k, text(String(x[k] ?? ""))]),
              ),
            ),
        }
      : null;
  state.lastNotice = text(raw.lastNotice, 2000);
  contentInput(raw, state);
  return state;
}
