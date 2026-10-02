const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../lib/store");
const d = require("../lib/domain");
const { setTheme, setWidget, appearance } = require("../lib/appearance");
test("主题和组件设置保存到当前账号，保留已有组件顺序及尺寸", () => {
  const memory = new Map(),
    wx = {
      getStorageSync: (key) => memory.get(key),
      setStorageSync: (key, value) => memory.set(key, structuredClone(value)),
    };
  const store = new Store(wx).open({ id: "a" });
  store.state.workspace.widgets.sizes = { priority: "full" };
  const order = [...store.state.workspace.widgets.order];
  for (const theme of d.THEMES) {
    setTheme(store, theme.id);
    assert.equal(appearance(store).themeId, theme.id);
  }
  setWidget(store, "priority", false);
  setWidget(store, "courses", false);
  setWidget(store, "priority", true);
  assert.deepEqual(store.state.workspace.widgets.hidden, ["courses"]);
  assert.deepEqual(store.state.workspace.widgets.order, order);
  assert.deepEqual(store.state.workspace.widgets.sizes, { priority: "full" });
  assert.ok(store.dirty);
  const reopened = new Store(wx).open({ id: "a" });
  assert.equal(reopened.state.workspace.theme, "medical");
  assert.deepEqual(
    d.validateCloudDocument(d.cloudDocument(reopened.state)).workspace.widgets
      .hidden,
    ["courses"],
  );
  assert.throws(() => setTheme(store, "unknown"));
  assert.throws(() => setWidget(store, "unknown", true));
});
