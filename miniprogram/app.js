const config = require("./config");
const { Api } = require("./lib/api");
const { Store } = require("./lib/store");
const d = require("./lib/domain");
App({
  onLaunch() {
    this.store = new Store(wx);
    this.api = new Api(wx, config.apiOrigin);
    this.api.onExpired = () => this.lock();
  },
  onShow() {
    if (this.store && this.store.user) {
      try {
        this.store.tick();
      } catch (error) {
        wx.showToast({ title: error.message, icon: "none" });
      }
    }
  },
  onHide() {
    if (this.store && this.store.user) {
      try {
        this.store.tick();
      } catch (error) {
        this.store.status = error.message;
      }
    }
  },
  guard() {
    if (this.store && this.store.user) return true;
    wx.reLaunch({ url: "/pages/login/index" });
    return false;
  },
  lock() {
    this.api.clear();
    this.store.close();
    // Remove personal view models from cached tab pages immediately.
    getCurrentPages().forEach((page) =>
      page.setData({
        tasks: [],
        items: [],
        logs: [],
        user: null,
        total: 0,
        pending: 0,
        minutes: 0,
      }),
    );
    wx.reLaunch({ url: "/pages/login/index" });
  },
  async login(email, password) {
    const user = await this.api.login(email, password);
    this.store.open(user);
    wx.switchTab({ url: "/pages/home/index" });
    this.store
      .sync(this.api)
      .then(() => this.refreshPage())
      .catch((error) => {
        if (this.store.user)
          wx.showToast({ title: error.message, icon: "none" });
        this.refreshPage();
      });
  },
  refreshPage() {
    const pages = getCurrentPages(),
      page = pages[pages.length - 1];
    if (page && page.refresh && this.store.user) page.refresh();
  },
  demo() {
    this.api.clear();
    this.store.open(
      { id: "__medstack_demo__", name: "体验工作区", email: "" },
      true,
    );
    if (!this.store.state.tasks.length && !this.store.state.events.length) {
      this.store.mutate((s) => {
        const today = d.dayKey();
        s.tasks = [
          d.taskInput({
            title: "整理本周学习笔记",
            quadrant: "do",
            due: today,
            project: "学习",
          }),
          d.taskInput({
            title: "阅读一篇研究论文",
            quadrant: "plan",
            due: today,
            project: "科研",
          }),
          d.taskInput({
            title: "确认小组讨论时间",
            quadrant: "delegate",
            project: "协作",
          }),
        ];
        s.events = [
          d.eventInput({
            title: "小组讨论（演示）",
            start: today + "T16:00",
            end: today + "T17:00",
            location: "线上",
          }),
        ];
      });
    }
    wx.switchTab({ url: "/pages/home/index" });
  },
});
