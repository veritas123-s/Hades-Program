const d = require("./domain");
const { appearance, applyChrome } = require("./appearance");
const notify = (error) =>
  wx.showToast({ title: error.message || String(error), icon: "none" });
function action(page, fn) {
  try {
    if (!getApp().guard()) return;
    fn(getApp().store);
    page.refresh();
  } catch (error) {
    notify(error);
  }
}
async function sync(page, resolution) {
  if (!getApp().guard() || page.data.busy) return;
  page.setData({ busy: true });
  try {
    await getApp().store.sync(getApp().api, resolution);
  } catch (error) {
    notify(error);
  } finally {
    page.setData({ busy: false });
    if (getApp().store.user) page.refresh();
  }
}
function summary(store) {
  const state = store.state,
    today = d.dayKey();
  applyChrome(wx, store);
  return {
    ...appearance(store),
    demo: store.demo,
    status: store.status,
    pending: state.tasks.filter((t) => !t.deletedAt && !t.completedAt).length,
    minutes: Math.floor(
      state.logs
        .filter((l) => !l.deletedAt && d.dayKey(l.startedAt) === today)
        .reduce((n, l) => n + l.durationMs, 0) / 60000,
    ),
  };
}
function showEditor() {
  if (wx.nextTick && wx.pageScrollTo)
    wx.nextTick(() => wx.pageScrollTo({ selector: ".editor", duration: 200 }));
}
module.exports = { d, action, sync, notify, summary, showEditor };
