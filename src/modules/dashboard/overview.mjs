import { agenda, learningEntries } from "../../agenda.mjs";
import {
  calendarEvents,
  eventsOnDay,
  courseCoverage,
} from "../../calendar.mjs";
import { beijingDay } from "../../briefing.mjs";
import { recentNews, groupNews } from "../../news-window.mjs";
export function overview(state, now = Date.now()) {
  const day = beijingDay(now),
    a = agenda(state, state.learning, now);
  const suppressed = new Set(
    [
      ...learningEntries(state, state.learning, { history: true, now }),
      ...learningEntries(state, state.learning, { deleted: true, now }),
    ]
      .map((x) => x.taskId)
      .filter(Boolean),
  );
  const tasks = state.tasks
    .filter((t) => !t.completedAt && !t.deletedAt && !suppressed.has(t.id))
    .toSorted(
      (a, b) =>
        (a.quadrant === "do" ? 0 : 1) - (b.quadrant === "do" ? 0 : 1) ||
        (a.due || "9999").localeCompare(b.due || "9999"),
    );
  const deadlines = a.entries.filter(
    (e) =>
      ["task", "assignment"].includes(e.kind) &&
      e.time &&
      beijingDay(e.time) === day,
  );
  const schedule = eventsOnDay(
    calendarEvents(state, { showTasks: false, showCompleted: false }),
    day,
  );
  const recent = recentNews(state.news?.items || [], now);
  const relevant = [...recent.groups, ...recent.uncertainGroups].flatMap(
    (g) => g.items,
  );
  const rows = [
    ...new Map(
      [
        ...relevant,
        ...(state.news?.items || []).filter(
          (x) => !x.deletedAt && x.activityDate === day,
        ),
      ].map((x) => [x.id, x]),
    ).values(),
  ];
  const news = groupNews(rows).map((group) => {
    const x = group.items[0],
      sources = [
        ...new Set(group.items.map((item) => item.source).filter(Boolean)),
      ];
    return {
      ...x,
      id: "news:" + group.id,
      kind: "news",
      time: x.publishedAt || x.updatedAt,
      subtitle:
        sources.length > 1
          ? `${sources[0]}等 ${sources.length} 个来源`
          : x.source,
    };
  });
  const notices = [
    ...a.entries.filter((x) => x.kind === "notice"),
    ...news,
  ].sort((a, b) => (b.time || 0) - (a.time || 0));
  return {
    day,
    tasks,
    deadlines,
    schedule,
    notices,
    coverage: courseCoverage(state, day, now),
    assignments: a.entries.filter((e) => e.kind === "assignment"),
    overdue: tasks.filter((t) => t.due && t.due < day).length,
  };
}
