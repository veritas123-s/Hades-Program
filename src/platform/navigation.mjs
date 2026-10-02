export const NAV_GROUPS = [
  { id: "efficiency", title: "效率工具" },
  { id: "academic", title: "教务信息" },
  { id: "news", title: "校园快讯" },
];
export function routeGroup(id) {
  if (["today", "assistant"].includes(id)) return null;
  if (["campus", "notifications", "canvas", "learning"].includes(id))
    return "academic";
  if (["campus-news", "briefing"].includes(id)) return "news";
  return "efficiency";
}
