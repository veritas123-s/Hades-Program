export function organizationName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 60 || !/^[\p{L}\p{N} ._·（）()\-]+$/u.test(name))
    throw Error("请输入公众号的准确名称，最多60字");
  return name;
}
export function followIntent(text) {
  if (typeof text !== "string") return null;
  const match = text
    .trim()
    .match(
      /^(?:请|帮我|请帮我)?\s*(?:添加关注|关注)\s*(?:公众号\s*[:：]?\s*)?[《“"「]?(.+?)[》”"」]?(?:的公众号|公众号)?[。！!]?$/u,
    );
  if (!match) return null;
  try {
    return organizationName(match[1]);
  } catch {
    return null;
  }
}
export function activityDetails(text) {
  const match = String(text).match(
    /(?:活动时间|活动日期|讲座时间|报告时间|会议时间|举办时间|直播时间|培训时间)[：:\s]*(20\d{2})[年/\-](\d{1,2})[月/\-](\d{1,2})日?/u,
  );
  if (!match) return {};
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(date + "T00:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return {};
  return {
    activityDate: date,
    activityEvidence: match[0],
    activityProvenance: "source",
  };
}
