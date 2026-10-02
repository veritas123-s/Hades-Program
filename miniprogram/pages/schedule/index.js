const { d, action, summary, showEditor } = require("../../lib/page");
Page({
  data: {
    day: d.dayKey(),
    items: [],
    editing: false,
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    editId: "",
  },
  onShow() {
    if (getApp().guard()) this.refresh();
  },
  refresh() {
    const store = getApp().store,
      day = this.data.day,
      coverage = d.courseCoverage(store.state, day);
    this.setData({
      ...summary(store),
      items: d.eventsOnDay(d.calendarEvents(store.state), day),
      coverage:
        coverage.status === "missing"
          ? "该日期没有课表同步记录，不能据此判断无课。"
          : coverage.status === "stale"
            ? "课表缓存超过 7 天，请在桌面端刷新后同步。"
            : "已载入该日期的课表缓存",
    });
  },
  day(e) {
    this.setData({ day: e.detail.value, editing: false });
    this.refresh();
  },
  move(e) {
    this.setData({
      day: d.addDays(this.data.day, Number(e.currentTarget.dataset.step)),
      editing: false,
    });
    this.refresh();
  },
  today() {
    this.setData({ day: d.dayKey(), editing: false });
    this.refresh();
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  add() {
    this.setData({
      editing: true,
      title: "",
      location: "",
      editId: "",
      startTime: "09:00",
      endTime: "10:00",
    });
    showEditor();
  },
  cancel() {
    this.setData({ editing: false });
  },
  save() {
    action(this, (store) => {
      store.mutate((s) =>
        s.events.push(
          d.eventInput({
            title: this.data.title,
            start: this.data.day + "T" + this.data.startTime,
            end: this.data.day + "T" + this.data.endTime,
            location: this.data.location,
          }),
        ),
      );
      this.setData({ editing: false });
    });
  },
  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "移入回收站？",
      content: "可在“我的”中恢复日程。",
      success: (result) => {
        if (result.confirm)
          action(this, (store) =>
            store.mutate((s) => {
              const item = s.events.find((x) => x.id === id);
              if (item) item.deletedAt = Date.now();
            }),
          );
      },
    });
  },
});
