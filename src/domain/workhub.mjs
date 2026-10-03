import { uid, validDay, dayKey } from "./dates.mjs";
import { taskInput } from "./tasks.mjs";
import { eventInput } from "./content.mjs";

export const PROJECT_STAGES = {
  planning: "筹备",
  active: "进行中",
  paused: "暂停",
  completed: "已完成",
};
export const NOTE_KINDS = {
  note: "学习笔记",
  literature: "文献阅读",
  experiment: "实验记录",
  meeting: "会议纪要",
};
export const NOTE_TEMPLATES = {
  note: "学习问题\n\n核心概念\n\n机制与证据\n\n待核验问题\n\n复习自测\n",
  literature:
    "题名与来源\n\nDOI / PMID（自行核验）\n\n研究问题\n\n设计、样本与对照\n\n主要结果（记录原始数值与出处）\n\n局限与替代解释\n\n可复用的方法\n",
  experiment:
    "实验目的\n\n日期与操作者\n\n材料与条件\n\n步骤与偏差\n\n原始数据位置\n\n实际观察\n\n结论与待验证项\n",
  meeting:
    "会议时间与参与者\n\n讨论事项\n\n确认决定\n\n待办、责任人与期限\n\n待确认事项\n",
};
export const initialHub = () => ({
  version: 1,
  projects: [],
  notes: [],
  audit: [],
});
function str(value, limit = 200, required = false) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > limit)
    throw Error("文字字段无效或过长");
  const result = value.trim();
  if (required && !result) throw Error("请填写必填内容");
  return result;
}
function date(value) {
  const result = str(value, 10);
  if (result && !validDay(result)) throw Error("日期无效");
  return result;
}
function array(value, limit) {
  if (!Array.isArray(value) || value.length > limit)
    throw Error("工作台记录数量或格式无效");
  return value;
}
function links(value = []) {
  const result = array(value, 2000).map((x) => str(x, 100, true));
  if (new Set(result).size !== result.length) throw Error("关联标识重复");
  return result;
}
function base(x, ids) {
  const id = str(x.id, 100, true);
  if (ids.has(id)) throw Error("工作台记录标识重复");
  ids.add(id);
  for (const key of ["createdAt", "updatedAt"])
    if (!Number.isFinite(x[key]) || x[key] < 0) throw Error("工作台时间无效");
  if (x.deletedAt != null && (!Number.isFinite(x.deletedAt) || x.deletedAt < 0))
    throw Error("删除时间无效");
  if (!Number.isSafeInteger(x.revision) || x.revision < 1)
    throw Error("记录版本无效");
  return {
    id,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    deletedAt: x.deletedAt ?? null,
    revision: x.revision,
  };
}
function projectFields(x) {
  if (!Object.hasOwn(PROJECT_STAGES, x.stage)) throw Error("项目阶段无效");
  return {
    title: str(x.title, 120, true),
    objective: str(x.objective, 10000),
    stage: x.stage,
    due: date(x.due),
    milestones: array(x.milestones ?? [], 60).map((m) => ({
      title: str(m.title, 200, true),
      due: date(m.due),
      done: !!m.done,
    })),
    taskIds: links(x.taskIds),
    eventIds: links(x.eventIds),
  };
}
function noteFields(x) {
  if (!Object.hasOwn(NOTE_KINDS, x.kind)) throw Error("记录类型无效");
  return {
    title: str(x.title, 160, true),
    body: str(x.body, 60000),
    kind: x.kind,
    projectId: str(x.projectId, 100),
    tags: array(x.tags ?? [], 12).map((t) => str(t, 30, true)),
    source: str(x.source, 2000),
    aiVisible: x.aiVisible === true,
  };
}
export function validateHub(input) {
  if (!input || input.version !== 1) throw Error("工作台数据版本不支持");
  const out = initialHub(),
    ids = new Set();
  out.projects = array(input.projects, 1000).map((x) => ({
    ...base(x, ids),
    ...projectFields(x),
  }));
  out.notes = array(input.notes, 5000).map((x) => ({
    ...base(x, ids),
    ...noteFields(x),
    history: array(x.history ?? [], 20).map((v) => ({
      ...noteFields(v),
      savedAt: Number.isFinite(v.savedAt) ? v.savedAt : 0,
    })),
  }));
  for (const item of out.notes)
    if (item.projectId && !out.projects.some((p) => p.id === item.projectId))
      throw Error("关联项目不存在");
  out.audit = array(input.audit, 3000).map((x) => ({
    id: str(x.id, 100, true),
    at: Number.isFinite(x.at) ? x.at : 0,
    action: str(x.action, 100, true),
    title: str(x.title, 200),
    entityId: str(x.entityId, 100, true),
  }));
  if (JSON.stringify(out).length > 12_000_000)
    throw Error("工作台容量已达上限，请先导出完整备份");
  return out;
}
const active = (x) => !x.deletedAt;
function get(hub, collection, id) {
  const item = hub[collection]?.find((x) => x.id === id);
  if (!item) throw Error("记录不存在");
  return item;
}
function checkProject(hub, id) {
  if (id && !hub.projects.some((p) => p.id === id && active(p)))
    throw Error("请先恢复关联项目，或选择其他项目");
}
function checkRevision(item, p) {
  if (p.revision !== item.revision)
    throw Error("记录已被更新，请关闭编辑后重新打开");
}
function record(hub, item, action, now) {
  item.updatedAt = now;
  hub.audit.push({
    id: uid(),
    entityId: item.id,
    title: item.title,
    action,
    at: now,
  });
  hub.audit = hub.audit.slice(-3000);
}
// All operations run inside Store.change; validation or disk failures roll back the entire transaction.
export function changeHub(state, action, p, now = Date.now()) {
  const hub = state.workhub;
  const kind = p.collection;
  let item;
  if (action === "hub.save") {
    if (!["projects", "notes"].includes(kind)) throw Error("记录类型无效");
    const old = p.id ? get(hub, kind, p.id) : null;
    if (old) {
      checkRevision(old, p);
      if (old.deletedAt) throw Error("请先恢复记录");
    }
    if (kind !== "projects") checkProject(hub, p.projectId);
    const fields =
      kind === "projects"
        ? projectFields({
            ...p,
            taskIds: old?.taskIds ?? [],
            eventIds: old?.eventIds ?? [],
          })
        : noteFields(p);
    item = {
      ...(old ?? { id: uid(), createdAt: now, deletedAt: null }),
      ...fields,
      updatedAt: now,
      revision: (old?.revision ?? 0) + 1,
    };
    if (kind === "notes")
      item.history = old
        ? [
            ...old.history,
            { ...noteFields(old), savedAt: old.updatedAt },
          ].slice(-20)
        : [];
    if (old) hub[kind][hub[kind].indexOf(old)] = item;
    else hub[kind].push(item);
    record(hub, item, old ? "编辑记录" : "创建记录", now);
  } else if (action === "hub.delete" || action === "hub.restore") {
    if (!["projects", "notes"].includes(kind)) throw Error("记录类型无效");
    item = get(hub, kind, p.id);
    checkRevision(item, p);
    item.deletedAt = action === "hub.delete" ? now : null;
    item.revision++;
    record(hub, item, item.deletedAt ? "移入回收站" : "恢复记录", now);
  } else if (
    action === "hub.link" ||
    action === "hub.createTask" ||
    action === "hub.createEvent"
  ) {
    item = get(hub, "projects", p.id);
    checkRevision(item, p);
    if (item.deletedAt) throw Error("请先恢复项目");
    if (action === "hub.link") {
      if (!["tasks", "events"].includes(p.target)) throw Error("关联类型无效");
      const key = p.target === "tasks" ? "taskIds" : "eventIds";
      if (
        !p.remove &&
        !state[p.target].some((x) => x.id === p.targetId && active(x))
      )
        throw Error("关联内容不存在或已删除");
      item[key] = p.remove
        ? item[key].filter((id) => id !== p.targetId)
        : [...new Set([...item[key], p.targetId])];
    } else if (action === "hub.createTask") {
      const task = taskInput({
        ...p.task,
        project: item.title.slice(0, 60),
        quadrant: p.task?.quadrant ?? "plan",
      });
      state.tasks.push(task);
      item.taskIds.push(task.id);
    } else {
      const event = eventInput(p.event ?? {});
      state.events.push(event);
      item.eventIds.push(event.id);
    }
    item.revision++;
    record(
      hub,
      item,
      action === "hub.link"
        ? p.remove
          ? "解除关联"
          : "关联内容"
        : action === "hub.createTask"
          ? "创建项目任务"
          : "创建项目日程",
      now,
    );
  } else if (action === "hub.noteRestore") {
    item = get(hub, "notes", p.id);
    checkRevision(item, p);
    const version = item.history[p.index];
    if (item.deletedAt || !Number.isInteger(p.index) || !version)
      throw Error("修订版本不可用");
    checkProject(hub, version.projectId);
    const current = { ...noteFields(item), savedAt: item.updatedAt };
    // Restoring an old body never silently re-enables AI sharing.
    Object.assign(item, noteFields(version), { aiVisible: false });
    item.history = [...item.history, current].slice(-20);
    item.revision++;
    record(hub, item, "恢复知识修订", now);
  } else throw Error("不支持的工作台操作");
  state.workhub = validateHub(hub);
  return item.id;
}
export function projectSummary(state, project, today = dayKey()) {
  const tasks = state.tasks.filter(
    (t) => project.taskIds.includes(t.id) && active(t),
  );
  const events = state.events.filter(
    (e) => project.eventIds.includes(e.id) && active(e),
  );
  const done = tasks.filter((t) => t.completedAt).length;
  return {
    tasks,
    events,
    done,
    total: tasks.length,
    overdue: tasks.filter((t) => !t.completedAt && t.due && t.due < today)
      .length,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    focusMs: state.logs
      .filter((l) => !l.deletedAt && project.taskIds.includes(l.taskId))
      .reduce((n, l) => n + l.durationMs, 0),
  };
}
export function searchHub(state, query, { aiOnly = false } = {}) {
  const q = str(query, 200).toLocaleLowerCase();
  const hub = state.workhub ?? initialHub();
  const visibleProjects = new Set(hub.projects.filter(active).map((p) => p.id));
  const rows = [
    ...hub.projects.filter(active).map((p) => ({
      type: "projects",
      id: p.id,
      title: p.title,
      text: p.objective,
    })),
    ...hub.notes
      .filter(
        (n) =>
          active(n) &&
          (!n.projectId || visibleProjects.has(n.projectId)) &&
          (!aiOnly || n.aiVisible),
      )
      .map((n) => ({
        type: "notes",
        id: n.id,
        title: n.title,
        text: `${n.tags.join(" ")}\n${n.source}\n${n.body}`,
      })),
    ...(!aiOnly
      ? state.tasks.filter(active).map((t) => ({
          type: "tasks",
          id: t.id,
          title: t.title,
          text: `${t.project} ${t.notes}`,
        }))
      : []),
    ...(!aiOnly
      ? state.events.filter(active).map((e) => ({
          type: "events",
          id: e.id,
          title: e.title,
          text: `${e.start} ${e.location} ${e.notes}`,
        }))
      : []),
  ];
  return rows
    .filter(
      (r) => !q || `${r.title}\n${r.text}`.toLocaleLowerCase().includes(q),
    )
    .slice(0, aiOnly ? 12 : 100)
    .map((r) => {
      const index = q ? r.text.toLocaleLowerCase().indexOf(q) : 0;
      return {
        ...r,
        text: r.text.slice(
          Math.max(0, index - 60),
          Math.max(0, index - 60) + (aiOnly ? 1200 : 240),
        ),
      };
    });
}
