const { d, action, sync, summary } = require("../../lib/page");
Page({
  data: { tasks: [], items: [], pending: 0, minutes: 0, busy: false },
  onShow() {
    if (getApp().guard()) this.refresh();
  },
  refresh() {
    const store = getApp().store,
      today = d.dayKey();
    const tasks = store.state.tasks
      .filter((t) => !t.deletedAt && !t.completedAt)
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
      .slice(0, 3);
    const todayItems = d.eventsOnDay(
      d.calendarEvents(store.state, { showTasks: false }),
      today,
    );
    const hidden = store.state.workspace.widgets.hidden;
    this.setData({
      ...summary(store),
      today,
      tasks,
      items: todayItems.filter((e) => e.kind === "event").slice(0, 4),
      courses: todayItems.filter((e) => e.kind === "course").slice(0, 4),
      showPriority: !hidden.includes("priority"),
      showFocus: !hidden.includes("focus"),
      showWeek: !hidden.includes("week"),
      showCourses: !hidden.includes("courses"),
      courseCoverage:
        d.courseCoverage(store.state, today).status === "fresh"
          ? "课表缓存已覆盖今天"
          : "课表未同步或缓存已过期，请先在桌面端刷新",
    });
  },
  toggle(e) {
    action(this, (store) =>
      store.mutate((s) => d.completeTask(s, e.currentTarget.dataset.id)),
    );
  },
  navigate(e) {
    wx.switchTab({ url: "/pages/" + e.currentTarget.dataset.page + "/index" });
  },
  sync() {
    return sync(this);
  },
});
