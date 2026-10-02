import { beijingDay } from "./briefing.mjs";

const normalized = (text) =>
  String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
function identity(row) {
  try {
    const url = new URL(row.url);
    if (url.hostname === "mp.weixin.qq.com") {
      if (url.pathname.startsWith("/s/"))
        return `url:${url.origin}${url.pathname}`;
      const biz = url.searchParams.get("__biz"),
        mid = url.searchParams.get("mid"),
        idx = url.searchParams.get("idx");
      if (biz && mid && idx) return `wechat:${biz}:${mid}:${idx}`;
    }
  } catch {}
  const title = normalized(row.title);
  return title.length >= 12
    ? `title:${title}:${row.activityDate || ""}`
    : `id:${row.id}`;
}
export function groupNews(rows) {
  const groups = new Map();
  for (const row of rows.filter((x) => !x.deletedAt)) {
    const key = identity(row);
    if (!groups.has(key))
      groups.set(key, { id: key, title: row.title, items: [] });
    const group = groups.get(key);
    if (!group.items.some((x) => x.id === row.id)) group.items.push(row);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.toSorted((a, b) => b.publishedAt - a.publishedAt),
    }))
    .sort((a, b) => b.items[0].publishedAt - a.items[0].publishedAt);
}
export function recentNews(rows, now = Date.now()) {
  const from = now - 86400000;
  const exact = [],
    uncertain = [];
  for (const row of rows) {
    if (row.deletedAt || !Number.isFinite(row.publishedAt)) continue;
    const legacyDateOnly =
      !row.publishedPrecision &&
      ["交大新闻网", "医学院新闻网"].includes(row.source) &&
      (row.publishedAt + 28800000) % 86400000 === 0;
    if (row.publishedPrecision === "day" || legacyDateOnly) {
      const day = row.date || beijingDay(row.publishedAt);
      if (day === beijingDay(now) || day === beijingDay(from))
        uncertain.push(row);
    } else if (row.publishedAt >= from && row.publishedAt <= now)
      exact.push(row);
  }
  return {
    from,
    to: now,
    groups: groupNews(exact),
    uncertainGroups: groupNews(uncertain),
    count: exact.length,
  };
}
