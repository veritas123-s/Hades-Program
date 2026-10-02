const path = require("node:path");
function harness() {
  let app, current;
  const memory = new Map(),
    messages = [],
    routes = [];
  const wx = {
    getStorageSync: (key) =>
      memory.has(key) ? structuredClone(memory.get(key)) : "",
    setStorageSync: (key, value) => memory.set(key, structuredClone(value)),
    showToast: (data) => messages.push(data.title),
    showModal: (data) => data.success({ confirm: true }),
    switchTab: (data) => routes.push(data.url),
    navigateTo: (data) => routes.push(data.url),
    reLaunch: (data) => routes.push(data.url),
    setNavigationBarColor() {},
    setTabBarStyle() {},
    setBackgroundColor() {},
  };
  global.wx = wx;
  global.getApp = () => app;
  global.getCurrentPages = () => (current ? [current] : []);
  global.App = (definition) => {
    app = definition;
  };
  const appPath = require.resolve("../app");
  delete require.cache[appPath];
  require(appPath);
  app.onLaunch();
  function page(name, show = true) {
    if (current && current.onHide) current.onHide();
    global.Page = (definition) => {
      current = {
        ...definition,
        data: structuredClone(definition.data),
        setData(patch) {
          Object.assign(this.data, structuredClone(patch));
        },
      };
    };
    const file = require.resolve(
      path.resolve(__dirname, "../pages", name, "index.js"),
    );
    delete require.cache[file];
    require(file);
    if (show && current.onShow) current.onShow();
    return current;
  }
  return { app, page, wx, memory, messages, routes };
}
const event = (dataset = {}, value) => ({
  currentTarget: { dataset },
  detail: { value },
});
module.exports = { harness, event };
