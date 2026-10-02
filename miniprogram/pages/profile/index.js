const { action, sync, summary } = require("../../lib/page");
const config = require("../../config");
Page({
  data: {
    user: null,
    busy: false,
    conflict: false,
    trash: [],
    version: config.version,
  },
  onShow() {
    if (getApp().guard()) this.refresh();
  },
  refresh() {
    const store = getApp().store;
    this.setData({
      ...summary(store),
      user: store.user,
      conflict: !!store.conflict,
      cloudVersion: store.version,
      trash: [
        ...store.state.tasks
          .filter((t) => t.deletedAt)
          .map((t) => ({ id: t.id, title: t.title, kind: "tasks" })),
        ...store.state.events
          .filter((t) => t.deletedAt)
          .map((t) => ({ id: t.id, title: t.title, kind: "events" })),
      ],
    });
  },
  sync() {
    return sync(this);
  },
  settings() {
    wx.navigateTo({ url: "/pages/settings/index" });
  },
  resolve(e) {
    const resolution = e.currentTarget.dataset.choice;
    wx.showModal({
      title:
        resolution === "local"
          ? "用本机版本更新云端？"
          : "用云端版本更新本机？",
      content:
        "两份完整数据会先保存在本机恢复副本中。此操作按整份工作区替换，不会逐条合并。",
      success: (result) => {
        if (result.confirm) sync(this, resolution);
      },
    });
  },
  restore(e) {
    action(this, (store) =>
      store.mutate((s) => {
        const kind = e.currentTarget.dataset.kind;
        if (!["tasks", "events"].includes(kind)) return;
        const item = s[kind].find((t) => t.id === e.currentTarget.dataset.id);
        if (item) item.deletedAt = null;
      }),
    );
  },
  async logout() {
    if (this.data.busy) return;
    const app = getApp();
    wx.showModal({
      title: "退出当前账号？",
      content:
        app.store.dirty && !app.store.demo
          ? "还有未同步修改，会保留在本机。重新登录同一账号后可继续同步。"
          : "本机缓存保留，重新进入后可继续。",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ busy: true });
        try {
          if (!app.store.demo)
            await app.api.call("/api/auth/sign-out", {}, true);
        } catch (error) {
          wx.showToast({
            title: "本机已退出，远端会话撤销未确认",
            icon: "none",
          });
        } finally {
          app.lock();
        }
      },
    });
  },
});
