import { validDay } from "../domain.mjs";
import { workspaceInput } from "./model.mjs";
export const BUILTIN_WIDGETS = {
  focus: "专注时钟",
  week: "本周投入",
  "quick-note": "随手记",
  courses: "今日课程",
  priority: "接下来做什么",
};
export function widgetIntent(text) {
  if (
    typeof text === "string" &&
    (/^(?:如何|怎样|怎么|能否|能不能)/.test(text.trim()) ||
      /不要|别添加/.test(text))
  )
    return null;
  if (
    typeof text !== "string" ||
    !text.includes("小组件") ||
    !/(?:添加|新建|创建|加到|放到)/.test(text)
  )
    return null;
  if (/倒计时/.test(text)) {
    const match = text.match(/(20\d{2})[年/\-](\d{1,2})[月/\-](\d{1,2})日?/),
      date = match
        ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
        : "";
    if (!validDay(date))
      throw Error(
        "请带上准确日期，例如：添加一个考试倒计时小组件，日期2026-12-20",
      );
    const title =
      text.match(
        /(?:叫|名为|名称[：:])\s*[「“"]?([^，。！？\n」”"]{1,60})/,
      )?.[1] || "重要日倒计时";
    return { kind: "countdown", title, date };
  }
  if (/打卡|习惯|检查表/.test(text))
    return {
      kind: "checklist",
      title:
        text.match(/(?:叫|名为|名称[：:])\s*([^，。！？\n]{1,60})/)?.[1] ||
        "每日打卡",
      items: [{ id: "item-1", text: "今天完成", done: false }],
    };
  const aliases = [
    ["focus", /专注|番茄/],
    ["week", /本周|时间统计|投入/],
    ["quick-note", /随手记|便笺|备忘/],
    ["courses", /课程|课表/],
    ["priority", /任务|待办/],
  ];
  const found = aliases.find(([, pattern]) => pattern.test(text));
  if (found)
    return { kind: "builtin", id: found[0], title: BUILTIN_WIDGETS[found[0]] };
  throw Error(
    "目前可添加专注、随手记、课表、投入统计、待办、倒计时与打卡小组件",
  );
}
export function addWidget(workspace, intent, customId) {
  const next = structuredClone(workspace),
    id = intent.kind === "builtin" ? intent.id : customId;
  if (intent.kind === "builtin" && !Object.hasOwn(BUILTIN_WIDGETS, id))
    throw Error("小组件类型无效");
  if (
    intent.kind !== "builtin" &&
    !["countdown", "checklist"].includes(intent.kind)
  )
    throw Error("小组件类型无效");
  if (intent.kind === "countdown" && !validDay(intent.date))
    throw Error("倒计时日期无效");
  next.widgets.order = [...new Set([...next.widgets.order, id])];
  next.widgets.hidden = next.widgets.hidden.filter((value) => value !== id);
  next.widgetData[id] = {
    version: 1,
    data:
      intent.kind === "builtin"
        ? { ...(next.widgetData[id]?.data || {}), explicitlyAdded: true }
        : { ...intent, deletedAt: null },
  };
  return workspaceInput(next);
}
export function customWidgetIds(workspace) {
  return Object.entries(workspace.widgetData || {})
    .filter(
      ([id, row]) =>
        id.startsWith("custom-") &&
        ["countdown", "checklist"].includes(row.data?.kind),
    )
    .map(([id]) => id);
}
