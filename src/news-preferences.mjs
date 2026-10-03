// Adapted from SJTU Agent's keyword ranking and blocked-category preferences.
// Copyright (c) 2026 kuan-er. MIT notice: docs/licenses/SJTU-AGENT-MIT.txt.
export const NEWS_TOPICS = [
  {
    id: "academic",
    title: "学术科研",
    words: ["学术", "科研", "论文", "课题", "讲座", "论坛", "研究"],
  },
  {
    id: "study",
    title: "课程考试",
    words: ["课程", "考试", "教务", "课表", "选课", "成绩", "教学"],
  },
  {
    id: "opportunity",
    title: "竞赛机会",
    words: ["竞赛", "奖学金", "招募", "报名", "实习", "招聘", "申报", "招生"],
  },
  {
    id: "life",
    title: "校园生活",
    words: ["社团", "文艺", "运动", "体育", "食堂", "宿舍", "志愿", "校园生活"],
  },
];
const normalize = (v) =>
  String(v || "")
    .normalize("NFKC")
    .toLowerCase();
export function newsPreferences(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("快讯订阅设置无效");
  const list = (name, topics = false) => {
    const values = input[name] ?? [];
    if (
      !Array.isArray(values) ||
      values.length > 30 ||
      values.some(
        (v) =>
          typeof v !== "string" ||
          !v.trim() ||
          v.length > 40 ||
          /[\x00-\x1f]/.test(v),
      )
    )
      throw Error("关键词每项最多40字，最多30项");
    if (topics && values.some((v) => !NEWS_TOPICS.some((t) => t.id === v)))
      throw Error("快讯分类无效");
    return [...new Set(values.map((v) => v.trim()))];
  };
  return {
    keywords: list("keywords"),
    blockedKeywords: list("blockedKeywords"),
    subscribedCategories: list("subscribedCategories", true),
    blockedCategories: list("blockedCategories", true),
  };
}
export function newsCategories(item) {
  const text = normalize(`${item.title || ""} ${item.excerpt || ""}`);
  return NEWS_TOPICS.filter((topic) =>
    topic.words.some((word) => text.includes(word)),
  ).map((topic) => topic.id);
}
export function selectNews(
  items,
  input = {},
  { subscribed = false, now = Date.now() } = {},
) {
  const preferences = newsPreferences(input);
  const selected = [];
  for (const item of items) {
    if (item.deletedAt) continue;
    const text = normalize(
      `${item.title || ""} ${item.excerpt || ""} ${item.source || ""}`,
    );
    const categories = newsCategories(item);
    if (
      preferences.blockedKeywords.some((word) =>
        text.includes(normalize(word)),
      ) ||
      preferences.blockedCategories.some((id) => categories.includes(id))
    )
      continue;
    const keywords = preferences.keywords.filter((word) =>
      text.includes(normalize(word)),
    );
    const topics = preferences.subscribedCategories.filter((id) =>
      categories.includes(id),
    );
    if (subscribed && !keywords.length && !topics.length) continue;
    const ageHours = Math.max(0, (now - item.publishedAt) / 3600000);
    const score = Math.min(
      1,
      keywords.length *
        Math.log(1 + 10 / Math.max(1, preferences.keywords.length)) *
        0.3 +
        topics.length * 0.5 +
        (ageHours < 2 ? 0.2 : ageHours < 6 ? 0.1 : ageHours < 12 ? 0.05 : 0),
    );
    selected.push({ ...item, categories, matchedKeywords: keywords, score });
  }
  return selected.sort(
    (a, b) =>
      (subscribed ? b.score - a.score : 0) || b.publishedAt - a.publishedAt,
  );
}
