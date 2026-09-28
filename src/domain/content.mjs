import { uid, validDay } from "./dates.mjs";
import { text } from "./text.mjs";
export const courseKey = (c) =>
  JSON.stringify([
    String(c.ids?.CSID || ""),
    String(c.ids?.MCSID || ""),
    c.title,
    c.start,
  ]);
export const visibleCourses = (state) => {
  const hidden = new Set(
    (state.courseTrash || []).filter((x) => x.deletedAt).map((x) => x.key),
  );
  return (state.courses || []).filter((c) => !hidden.has(courseKey(c)));
};
export function eventInput(p, old = {}) {
  const title = text(p.title),
    start = text(p.start, 30),
    end = text(p.end, 30);
  const valid = (value) =>
    /^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) &&
    validDay(value.slice(0, 10));
  if (!title) throw Error("请填写日程标题");
  if (!valid(start) || !valid(end) || end <= start)
    throw Error("结束时间必须晚于开始时间");
  if (p.allDay && (!start.endsWith('T00:00') || !end.endsWith('T00:00')))
    throw Error('全天日程须从零点开始，到结束日期后的零点结束');
  if (
    Date.parse(end + "+08:00") - Date.parse(start + "+08:00") >
    366 * 86400000
  )
    throw Error("单条日程不能超过一年");
  return {
    id: old.id || uid(),
    title,
    start,
    end,
    location: text(p.location, 200),
    notes: text(p.notes, 5000),
    allDay: !!p.allDay,
    calendarUid: text(old.calendarUid || p.calendarUid, 600),
    createdAt: old.createdAt || Date.now(),
    deletedAt: old.deletedAt || null,
  };
}
export function contentInput(raw, state) {
  const lists = raw.lists ?? [];
  if (!Array.isArray(lists) || lists.length > 2000) throw Error("清单数据无效");
  const names = new Set(),
    listIds = new Set();
  state.lists = lists.map((x) => {
    const name = text(x.name, 60);
    if (
      !name ||
      names.has(name) ||
      typeof x.id !== "string" ||
      !x.id ||
      x.id.length > 100 ||
      listIds.has(x.id) ||
      (x.deletedAt != null && !Number.isFinite(x.deletedAt))
    )
      throw Error("清单名称或标识无效");
    names.add(name);
    listIds.add(x.id);
    return { id: x.id, name, deletedAt: x.deletedAt || null };
  });
  ensureLists(state);
  if (
    raw.events !== undefined &&
    (!Array.isArray(raw.events) || raw.events.length > 20000)
  )
    throw Error("日程数据无效");
  const ids = new Set();
  state.events = (raw.events || []).map((x) => {
    if (
      typeof x.id !== "string" ||
      !x.id ||
      x.id.length > 100 ||
      ids.has(x.id) ||
      !Number.isFinite(x.createdAt) ||
      x.createdAt < 0 ||
      (x.deletedAt != null && !Number.isFinite(x.deletedAt))
    )
      throw Error("日程标识无效");
    ids.add(x.id);
    return eventInput(x, x);
  });
  if (
    raw.courseTrash !== undefined &&
    (!Array.isArray(raw.courseTrash) || raw.courseTrash.length > 20000)
  )
    throw Error("课程回收站无效");
  state.courseTrash = (raw.courseTrash || []).map((x) => {
    if (
      !x.course ||
      typeof x.course.title !== "string" ||
      typeof x.course.start !== "string" ||
      typeof x.course.end !== "string" ||
      !validDay(x.course.start.slice(0, 10)) ||
      !validDay(x.course.end.slice(0, 10)) ||
      x.course.end <= x.course.start ||
      typeof x.key !== "string" ||
      x.key !== courseKey(x.course) ||
      !Number.isFinite(x.deletedAt)
    )
      throw Error("课程回收站内容无效");
    return { key: x.key, course: x.course, deletedAt: x.deletedAt };
  });
}
export function changeList(s, action, p) {
  const name = text(p.name, 60);
  if (action === "list.save") {
    if (!name || name === "全部清单") throw Error("请输入有效清单名称");
    const old = s.lists.find((x) => x.id === p.id);
    if (
      s.lists.some(
        (x) => x.name === name && x.id !== old?.id && (!x.deletedAt || old),
      )
    )
      throw Error("清单名称已存在");
    if (old?.name === "收集箱" && name !== "收集箱")
      throw Error("收集箱是默认清单，可清空但不能重命名");
    if (old) {
      const prior = old.name;
      old.name = name;
      old.deletedAt = null;
      for (const t of s.tasks) if (t.project === prior) t.project = name;
    } else {
      const deleted = s.lists.find((x) => x.name === name);
      if (deleted) deleted.deletedAt = null;
      else s.lists.push({ id: uid(), name, deletedAt: null });
    }
  } else {
    const list = s.lists.find((x) => x.id === p.id);
    if (!list) throw Error("清单不存在");
    if (action === "list.restore") {
      list.deletedAt = null;
      return;
    }
    if (list.name === "收集箱" && !p.withTasks)
      throw Error("收集箱只能清空任务");
    if (list.name !== "收集箱") list.deletedAt = Date.now();
    for (const t of s.tasks)
      if (t.project === list.name && !t.deletedAt) {
        if (p.withTasks) t.deletedAt = Date.now();
        else t.project = "收集箱";
      }
  }
}

export function ensureLists(state) {
  for (const name of new Set([
    "收集箱",
    ...state.tasks.filter((x) => !x.deletedAt).map((x) => x.project),
  ])) {
    const list = state.lists.find((x) => x.name === name);
    if (list) list.deletedAt = null;
    else state.lists.push({ id: uid(), name, deletedAt: null });
  }
}
