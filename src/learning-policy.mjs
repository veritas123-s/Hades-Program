const DAY = 86400000;
const clean = (x) =>
  String(x || "")
    .replace(/\s+/g, " ")
    .trim();
export const noticeAliases = (x) => [
  ...new Set(
    [x.id, ...(Array.isArray(x.aliases) ? x.aliases : [])].filter(
      (v) => typeof v === "string" && v.startsWith("notice:") && v.length < 300,
    ),
  ),
];
export function sameNotice(a, b) {
  // Distinct platform notices may have identical text and publication time.
  return noticeAliases(a).some((id) => noticeAliases(b).includes(id));
}
export function noticeDeleted(item, workflows = {}) {
  return (workflows.noticeArchive || []).some(
    (e) => e.deletedAt && sameNotice(e.item, item),
  );
}
export function mergeNotices(items) {
  const result = [];
  for (const item of items) {
    const index = result.findIndex((x) => sameNotice(x, item));
    if (index < 0) result.push(item);
    else
      result[index] = {
        ...result[index],
        ...item,
        aliases: [
          ...new Set([...noticeAliases(result[index]), ...noticeAliases(item)]),
        ],
      };
  }
  return result;
}
const normalizedTitle = (x) =>
  clean(x)
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s·•_-]/g, "")
    .toLowerCase();
export function courseRelevance(course, state = {}, now = Date.now()) {
  const key = course.key || `${course.id}:${course.classId}`,
    choice = state.workflows?.courseChoices?.[key] || "auto";
  if (choice === "hide")
    return { active: false, reason: "已设为不关注", code: "hidden" };
  if (choice === "follow")
    return { active: true, reason: "手动关注", code: "follow" };
  if (course.archived)
    return { active: false, reason: "平台已归档", code: "archived" };
  const today = new Date(now + 8 * 3600000),
    year = today.getUTCFullYear(),
    month = today.getUTCMonth() + 1;
  const academicYear = month >= 9 ? year : year - 1;
  const term = clean(course.title).match(/(20\d{2})\s*[-—–~～至]\s*(20\d{2})/);
  if (term && Number(term[2]) <= academicYear)
    return { active: false, reason: "课程名称属于往年学年", code: "old-term" };
  const name = normalizedTitle(course.title);
  const matching = (state.courses || []).some((c) => {
    const date = Date.parse(
      c.start?.replace(" ", "T") +
        (/(?:Z|[+-]\d\d:\d\d)$/.test(c.start || "") ? "" : "+08:00"),
    );
    return (
      name &&
      normalizedTitle(c.title) === name &&
      date >= now - 45 * DAY &&
      date <= now + 120 * DAY
    );
  });
  if (matching)
    return { active: true, reason: "与近期校园课表匹配", code: "timetable" };
  return { active: false, reason: "学期未确认，可手动关注", code: "unknown" };
}
export function assignmentDisposition(
  item,
  state = {},
  learning = {},
  now = Date.now(),
) {
  const key = item.courseKey || /^work:(\d+:\d+):/.exec(item.id || "")?.[1];
  const catalog = learning.courses || [];
  const course = catalog.find((c) => c.key === key) || {
    key,
    title: item.course || "",
  };
  const relevance = courseRelevance(course, state, now);
  if (item.done)
    return { active: false, reason: "平台已完成或已提交", code: "done" };
  if (item.closed)
    return { active: false, reason: "平台已截止或已结束", code: "closed" };
  if (["hidden", "archived", "old-term"].includes(relevance.code))
    return relevance;
  if (learning.catalogComplete && key && !catalog.some((c) => c.key === key))
    return { active: false, reason: "已不在本次学生课程列表", code: "removed" };
  if (item.deadline && item.deadline < now - 14 * DAY)
    return { active: false, reason: "截止已超过14天", code: "expired" };
  if (item.deadline && item.deadline > now + 180 * DAY)
    return { active: false, reason: "截止在半年以后", code: "future" };
  if (item.deadline && !item.yearInferred)
    return { active: true, reason: "近期未完成作业", code: "actionable" };
  if (relevance.active)
    return {
      active: true,
      reason: item.deadline ? "关注课程，年份需核对" : "关注课程，截止需核对",
      code: "followed",
    };
  return {
    active: false,
    reason: item.yearInferred
      ? "截止年份不明，需确认课程"
      : "课程学期和截止时间待确认",
    code: "pending",
  };
}
export function learningSelection(state, learning = {}, now = Date.now()) {
  const w = state.workflows || {},
    archive = w.noticeArchive || [];
  const notices = mergeNotices([
    ...archive.filter((e) => !e.deletedAt).map((e) => e.item),
    ...(learning.items || []).filter((x) => x.kind === "notice"),
  ]);
  const assignments = (learning.items || []).filter(
    (x) => x.kind === "assignment",
  );
  const current = [],
    history = [],
    deleted = [];
  for (const x of notices) {
    if (noticeDeleted(x, w)) continue;
    const published = x.publishedAt ?? x.updatedAt;
    const restored = archive.some((e) => !e.deletedAt && sameNotice(e.item, x));
    const recent =
      published > 0 && published >= now - 30 * DAY && published <= now + DAY;
    (recent || restored ? current : history).push({
      ...x,
      reason: recent
        ? "近30天通知"
        : restored
          ? "手动恢复"
          : "历史通知或发布时间未知",
    });
  }
  for (const e of archive.filter((e) => e.deletedAt))
    if (!deleted.some((x) => sameNotice(x, e.item))) deleted.push(e.item);
  for (const x of assignments) {
    const task = state.tasks?.find((t) => t.id === x.taskId);
    const dismissed = (w.assignmentArchive || []).find(
      (e) => e.item.id === x.id && e.deletedAt,
    );
    if (dismissed || task?.deletedAt) {
      deleted.push(x);
      continue;
    }
    const d = assignmentDisposition(x, state, learning, now);
    (d.active && !task?.completedAt ? current : history).push({
      ...x,
      reason: task?.completedAt ? "本机任务已完成" : d.reason,
      disposition: d.code,
    });
  }
  for (const e of w.assignmentArchive || [])
    if (e.deletedAt && !deleted.some((x) => x.id === e.item.id))
      deleted.push(e.item);
  return { current, history, deleted };
}
