const { d, action, summary, showEditor } = require("../../lib/page");
Page({
  data: {
    tasks: [],
    quadrants: d.QUADRANTS,
    filter: "all",
    showCompleted: false,
    editing: false,
    title: "",
    due: "",
    project: "",
    quadrant: 1,
    editId: "",
  },
  onShow() {
    if (getApp().guard()) this.refresh();
  },
  refresh() {
    const store = getApp().store;
    this.setData({
      ...summary(store),
      tasks: store.state.tasks
        .filter(
          (t) =>
            !t.deletedAt &&
            !!t.completedAt === this.data.showCompleted &&
            (this.data.filter === "all" || t.quadrant === this.data.filter),
        )
        .map((t) => ({
          ...t,
          label: d.QUADRANTS.find((q) => q.id === t.quadrant).title,
        })),
    });
  },
  filter(e) {
    this.setData({ filter: e.currentTarget.dataset.id });
    this.refresh();
  },
  completed() {
    this.setData({ showCompleted: !this.data.showCompleted });
    this.refresh();
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  add() {
    this.setData({
      editing: true,
      editId: "",
      title: "",
      due: "",
      project: "",
      quadrant: 1,
    });
    showEditor();
  },
  edit(e) {
    const task = getApp().store.state.tasks.find(
      (t) => t.id === e.currentTarget.dataset.id,
    );
    if (task)
      this.setData({
        editing: true,
        editId: task.id,
        title: task.title,
        due: task.due,
        project: task.project,
        quadrant: d.QUADRANTS.findIndex((q) => q.id === task.quadrant),
      });
    showEditor();
  },
  cancel() {
    this.setData({ editing: false });
  },
  clearDate() {
    this.setData({ due: "" });
  },
  save() {
    action(this, (store) => {
      store.mutate((s) => {
        const old = s.tasks.find((t) => t.id === this.data.editId),
          q = d.QUADRANTS[Number(this.data.quadrant)];
        const task = d.taskInput(
          {
            ...old,
            title: this.data.title,
            due: this.data.due,
            dueTime: this.data.due ? old && old.dueTime : "",
            project: this.data.project,
            quadrant: q.id,
          },
          old,
        );
        if (old) Object.assign(old, task);
        else s.tasks.push(task);
      });
      this.setData({ editing: false });
    });
  },
  toggle(e) {
    action(this, (store) =>
      store.mutate((s) => d.completeTask(s, e.currentTarget.dataset.id)),
    );
  },
  remove() {
    const id = this.data.editId;
    wx.showModal({
      title: "移入回收站？",
      content: "任务会保留删除标记，可在“我的”中恢复。",
      success: (result) => {
        if (result.confirm)
          action(this, (store) => {
            store.mutate((s) => {
              const task = s.tasks.find((t) => t.id === id);
              if (task) task.deletedAt = Date.now();
            });
            this.setData({ editing: false });
          });
      },
    });
  },
});
