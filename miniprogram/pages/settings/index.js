const { d, action, summary } = require("../../lib/page");
const { setTheme, setWidget, WIDGETS } = require("../../lib/appearance");
Page({
  data: { themes: d.THEMES, widgets: [], theme: "" },
  onShow() {
    if (getApp().guard()) this.refresh();
  },
  refresh() {
    const store = getApp().store;
    this.setData({
      ...summary(store),
      theme: store.state.workspace.theme,
      widgets: WIDGETS.map((w) => ({
        ...w,
        visible: !store.state.workspace.widgets.hidden.includes(w.id),
      })),
    });
  },
  theme(e) {
    action(this, (store) => setTheme(store, e.currentTarget.dataset.id));
  },
  widget(e) {
    action(this, (store) =>
      setWidget(store, e.currentTarget.dataset.id, e.detail.value),
    );
  },
});
