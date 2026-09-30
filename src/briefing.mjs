import { dayKey, addDays, QUADRANTS, validDay } from "./domain.mjs";
import { visibleCourses } from "./domain/content.mjs";
export const beijingDay = (value = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export function buildFeed(state, now = Date.now(), news = null) {
  const dates = new Map();
  for (const range of state.courseRanges) {
    if (now - range.syncedAt > 7 * 86400000 || range.syncedAt > now) continue;
    for (
      let d = range.start, i = 0;
      d < range.end && i < 94;
      d = addDays(d, 1), i++
    )
      dates.set(d, Math.max(dates.get(d) || 0, range.syncedAt));
  }
  const verified_dates = [...dates.keys()].sort(),
    courses = {};
  for (const d of verified_dates) courses[d] = [];
  for (const c of visibleCourses(state)) {
    const d = c.start.slice(0, 10);
    if (!dates.has(d)) continue;
    (courses[d] ??= []).push({
      name: c.title,
      start: c.start.slice(11, 16),
      end: c.end.slice(11, 16),
      room: c.location || "",
    });
  }
  return {
    ...(news
      ? {
          campus_news: {
            date: beijingDay(now),
            collected_at: news.lastAttempt
              ? new Date(news.lastAttempt).toISOString()
              : null,
            items: (news.items || [])
              .filter((x) => !x.deletedAt && x.activityDate === beijingDay(now))
              .slice(0, 60)
              .map(({ source, title, url, excerpt }) => ({
                source,
                title,
                url,
                excerpt,
              })),
            summary:
              news.summary?.date === beijingDay(now) &&
              news.summary?.kind === "activities"
                ? news.summary.text
                : "",
            coverage: (news.coverage || []).map(({ source, status, note }) => ({
              source,
              status,
              note,
            })),
          },
        }
      : {}),
    schema_version: 1,
    source: "AI·VERITAS·V1.3",
    timezone: "Asia/Shanghai",
    generated_at: new Date(now).toISOString(),
    timetable: {
      synced_at: verified_dates.length
        ? new Date(Math.min(...dates.values())).toISOString()
        : new Date(0).toISOString(),
      verified_dates,
      verified_at: Object.fromEntries(
        [...dates].map(([d, ts]) => [d, new Date(ts).toISOString()]),
      ),
      courses,
    },
    tasks: state.tasks
      .filter((t) => !t.completedAt && !t.deletedAt)
      .map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project,
        quadrant: t.quadrant,
        quadrant_label:
          QUADRANTS.find((q) => q.id === t.quadrant)?.subtitle || "",
        due: t.due || null,
        due_time: t.dueTime || null,
        reminder: t.reminder || null,
        estimate_minutes: t.estimate,
        subtasks_total: t.subtasks.length,
        subtasks_done: t.subtasks.filter((s) => s.done).length,
      })),
    rules: {
      preview_day_offset: -1,
      review_day_offset: 0,
      morning_time: "08:00",
      evening_time: "21:00",
      ddl_lookahead_days: 3,
      task_freshness_hours: 48,
    },
  };
}
export function briefingPreview(feed, date = beijingDay()) {
  if (!validDay(date)) throw new Error("预览日期无效");
  const cache = feed.timetable,
    study = [],
    warnings = [];
  for (const [d, kind] of [
    [date, "复习"],
    [addDays(date, 1), "预习"],
  ]) {
    if (!cache.verified_dates.includes(d)) {
      warnings.push(`${d} 课表未覆盖或已过期，请按实际课表${kind}。`);
      continue;
    }
    const names = new Map();
    for (const course of cache.courses[d] || []) {
      const times = names.get(course.name) || [];
      times.push(`${course.start}–${course.end}`);
      names.set(course.name, times);
    }
    for (const [name, times] of names)
      study.push({
        id: `${kind}:${d}:${name}`,
        title: `${kind} · ${name}`,
        date: d,
        times: times.join("、"),
        kind,
      });
  }
  const deadlines = feed.tasks
    .filter((t) => t.due && t.due <= addDays(date, 3))
    .sort(
      (a, b) =>
        a.due.localeCompare(b.due) ||
        (a.due_time || "99").localeCompare(b.due_time || "99"),
    );
  const priorities = feed.tasks
    .filter((t) => t.quadrant === "do" || t.quadrant === "plan")
    .slice(0, 10);
  return { date, study, warnings, deadlines, priorities };
}
