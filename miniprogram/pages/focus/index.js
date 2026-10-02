const { d, action, summary } = require("../../lib/page");
Page({
  data: {
    display: "25:00",
    timerStatus: "idle",
    duration: 25,
    selected: 0,
    choices: [{ id: "", title: "自由专注" }],
    logs: [],
    modeLabel: "专注",
  },
  onShow() {
    if (!getApp().guard()) return;
    this.tick();
    this.interval = setInterval(() => this.tick(), 1000);
  },
  onHide() {
    clearInterval(this.interval);
    this.interval = null;
  },
  onUnload() {
    clearInterval(this.interval);
  },
  tick() {
    if (!getApp().store.user) {
      clearInterval(this.interval);
      return;
    }
    action(this, (store) => store.tick());
  },
  refresh() {
    const store = getApp().store,
      timer = store.state.timer;
    const milliseconds =
      timer.status === "idle"
        ? Number(this.data.duration) * 60000
        : Math.max(0, timer.targetMs - d.elapsed(timer));
    const seconds = Math.ceil(milliseconds / 1000);
    const choices = [
      { id: "", title: "自由专注" },
      ...store.state.tasks
        .filter((t) => !t.deletedAt && !t.completedAt)
        .map((t) => ({ id: t.id, title: t.title })),
    ];
    this.setData({
      ...summary(store),
      timerStatus: timer.status,
      display:
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        ":" +
        String(seconds % 60).padStart(2, "0"),
      taskTitle: timer.taskTitle || "自由专注",
      modeLabel:
        timer.mode === "short" || timer.mode === "long" ? "休息" : "专注",
      choices,
      selected: Math.min(this.data.selected, choices.length - 1),
      logs: store.state.logs
        .filter((l) => !l.deletedAt)
        .slice(-5)
        .reverse()
        .map((l) => ({
          id: l.id,
          title: l.title,
          date: d.dayKey(l.startedAt),
          minutes: Math.round(l.durationMs / 6000) / 10,
        })),
    });
  },
  duration(e) {
    this.setData({ duration: e.detail.value });
  },
  select(e) {
    this.setData({ selected: Number(e.detail.value) });
  },
  start() {
    action(this, (store) =>
      store.mutate(
        (s) =>
          d.timerAction(s, "start", {
            mode: "focus",
            durationMinutes: Number(this.data.duration),
            taskId: (this.data.choices[this.data.selected] || {}).id,
          }),
        false,
      ),
    );
  },
  pause() {
    action(this, (store) =>
      store.mutate((s) => d.timerAction(s, "pause"), false),
    );
  },
  finish() {
    action(this, (store) => store.mutate((s) => d.timerAction(s, "finish")));
  },
});
