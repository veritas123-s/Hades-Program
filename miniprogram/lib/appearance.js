const d = require("./domain");
const PALETTES = {
  monument: ["#eee8dc", "#fcf9f1", "#40392d", "#7c725f", "#82652e", "#e4dbca"],
  paper: ["#f6f8f5", "#ffffff", "#283e30", "#6b7e70", "#52705e", "#e9f0e8"],
  midnight: ["#141c2b", "#242f43", "#e7ecfa", "#acb7cc", "#bbc5ff", "#303c55"],
  violet: ["#f0e9fa", "#fbf8ff", "#413151", "#80708e", "#7656a8", "#e7def0"],
  orbital: ["#e8dfc9", "#f7eed8", "#203943", "#776e5d", "#a4412e", "#dfd4ba"],
  millennium: [
    "#e8f0fb",
    "#f8fcff",
    "#253a5e",
    "#6a7e9b",
    "#346ad4",
    "#dce8f8",
  ],
  coast: ["#edf3ee", "#fffdf5", "#244b50", "#708a87", "#267c88", "#d8eae8"],
  medical: ["#f3f8fb", "#ffffff", "#183f4e", "#6d8790", "#086b91", "#e6f1f5"],
};
const WIDGETS = [
  { id: "priority", name: "待办任务", description: "展示最近三件待办" },
  { id: "focus", name: "专注入口", description: "开始专注与今日统计" },
  { id: "week", name: "今日日程", description: "展示已保存的个人日程" },
  { id: "courses", name: "今日课程", description: "展示课表与缓存覆盖状态" },
];
function appearance(store) {
  const requested = store.state.workspace.theme;
  const id = PALETTES[requested] ? requested : "medical";
  const p = PALETTES[id];
  const keys = ["--bg", "--card", "--ink", "--muted", "--accent", "--soft"];
  return {
    themeStyle:
      keys.map((key, i) => key + ":" + p[i]).join(";") +
      ";--on-accent:" +
      (id === "midnight" ? "#141c2b" : "#ffffff"),
    themeId: id,
    customTheme: id !== requested,
  };
}
let lastPlatform, lastTheme;
function applyChrome(platform, store) {
  const { themeId } = appearance(store),
    p = PALETTES[themeId];
  if (lastPlatform === platform && lastTheme === themeId) return;
  lastPlatform = platform;
  lastTheme = themeId;
  if (platform.setNavigationBarColor)
    platform.setNavigationBarColor({
      frontColor: themeId === "midnight" ? "#ffffff" : "#000000",
      backgroundColor: p[0],
    });
  if (platform.setTabBarStyle)
    platform.setTabBarStyle({
      color: p[3],
      selectedColor: p[4],
      backgroundColor: p[1],
      borderStyle: themeId === "midnight" ? "black" : "white",
    });
  if (platform.setBackgroundColor)
    platform.setBackgroundColor({ backgroundColor: p[0] });
}
function setTheme(store, id) {
  if (!d.THEMES.some((t) => t.id === id)) throw Error("主题不存在");
  store.mutate((s) => {
    s.workspace = d.updateWorkspace(s.workspace, { theme: id });
  });
}
function setWidget(store, id, visible) {
  if (!WIDGETS.some((w) => w.id === id)) throw Error("小组件不存在");
  store.mutate((s) => {
    const hidden = new Set(s.workspace.widgets.hidden);
    if (visible) hidden.delete(id);
    else hidden.add(id);
    s.workspace = d.updateWorkspace(s.workspace, {
      widgets: { hidden: [...hidden] },
    });
  });
}
module.exports = { appearance, applyChrome, setTheme, setWidget, WIDGETS };
