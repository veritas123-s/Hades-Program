import { newsURL } from "./news-service.mjs";

export function sharedNewsBatch(value, receivedAt = Date.now()) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.serverNow) ||
    !Number.isSafeInteger(value.nextRunAt) || value.nextRunAt < value.serverNow - 90000 ||
    value.nextRunAt > value.serverNow + 3600000 || !Array.isArray(value.sources) ||
    value.sources.length > 40 || value.sources.some(s => typeof s !== "string" || s.length > 60) ||
    !Array.isArray(value.items) || value.items.length > 3000 || !Array.isArray(value.coverage) || value.coverage.length > 42)
    throw Error("服务器快讯格式无效，已保留本机消息");
  const items = value.items.map(row => {
    if (!row || typeof row.id !== "string" || row.id.length > 200 ||
      typeof row.title !== "string" || !row.title || row.title.length > 300 ||
      typeof row.source !== "string" || row.source.length > 60 ||
      !Number.isSafeInteger(row.publishedAt) || row.publishedAt > value.serverNow + 300000 ||
      typeof row.excerpt !== "string" || row.excerpt.length > 1000)
      throw Error("服务器文章格式无效，已保留本机消息");
    return { id: row.id, source: row.source, title: row.title, url: newsURL(row.url),
      publishedAt: row.publishedAt, date: row.date, excerpt: row.excerpt, searchResult: !!row.searchResult,
      imageURL: row.imageURL, activityDate: row.activityDate, activityEvidence: row.activityEvidence,
      activityProvenance: row.activityProvenance };
  });
  return { items, shared: { serverNow: value.serverNow, receivedAt, nextRunAt: value.nextRunAt,
    lastStartedAt: value.lastStartedAt, lastFinishedAt: value.lastFinishedAt, lastSuccessAt: value.lastSuccessAt,
    sources: value.sources, busy: !!value.busy, error: String(value.error || "").slice(0, 200) },
    coverage: value.coverage.map(row => ({ source: String(row.source || "").slice(0, 60),
      status: row.status === "partial" ? "partial" : "unavailable",
      count: Number.isSafeInteger(row.count) && row.count >= 0 ? row.count : 0,
      note: String(row.note || "").slice(0, 300) })) };
}
