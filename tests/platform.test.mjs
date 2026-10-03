import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initialState, validateState } from "../src/domain.mjs";
import {
  initialWorkspace,
  workspaceInput,
  updateWorkspace,
  saveWidgetData,
} from "../src/platform/model.mjs";
import {
  createRegistry,
  widgetServices,
  widgetLayout,
  migrateWidgetData,
} from "../src/platform/registry.mjs";
import { Store } from "../electron/store.mjs";
import { makeRouter } from "../electron/commands/router.mjs";
import { createCommandRouter } from "../electron/commands/index.mjs";
const widget = {
  id: "demo-widget",
  title: "合成组件",
  apiVersion: 1,
  stateVersion: 1,
  version: "1.0.0",
  data: ["tasks"],
  commands: ["task.complete"],
  uiActions: [],
  defaults: { count: 0 },
  Component: () => null,
};
const module = {
  id: "demo-module",
  apiVersion: 1,
  routes: [{ id: "demo-page", Component: () => null }],
  widgets: [widget],
};
test("V1.1迁移到V1.2保留业务字段和原始副本，补齐工作台", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-migration-"));
  const old = initialState();
  old.schemaVersion = 2;
  delete old.workspace;
  old.cycles = 9;
  const raw = JSON.stringify(old);
  fs.writeFileSync(path.join(dir, "veritas-data.json"), raw);
  const store = new Store(dir);
  assert.equal(store.state.schemaVersion, 6);
  assert.deepEqual(store.state.workspace, initialWorkspace());
  assert.equal(store.state.cycles, 9);
  assert.equal(
    fs.readFileSync(
      path.join(
        dir,
        fs.readdirSync(dir).find((f) => f.startsWith("veritas-data.pre-schema")),
      ),
      "utf8",
    ),
    raw,
  );
});
test("更新版本的数据不得降级到旧备份或被改写", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-future-"));
  const future = { ...initialState(), schemaVersion: 99 };
  const raw = JSON.stringify(future);
  fs.writeFileSync(path.join(dir, "veritas-data.json"), raw);
  fs.writeFileSync(
    path.join(dir, "veritas-data.json.bak"),
    JSON.stringify(initialState()),
  );
  assert.throws(() => new Store(dir), /更新版本/);
  assert.equal(
    fs.readFileSync(path.join(dir, "veritas-data.json"), "utf8"),
    raw,
  );
});
test("主题与布局修改互不覆盖，不触碰小组件内容", () => {
  let state = initialWorkspace();
  state = saveWidgetData(state, {
    id: "quick-note",
    version: 1,
    data: { text: "合成便笺" },
  });
  state = updateWorkspace(state, { theme: "midnight" });
  state = updateWorkspace(state, {
    widgets: {
      hidden: ["week"],
      order: ["courses", "priority", "focus", "week"],
    },
  });
  assert.equal(state.theme, "midnight");
  assert.equal(state.widgetData["quick-note"].data.text, "合成便笺");
  assert.deepEqual(state.widgets.order, [
    "courses",
    "priority",
    "focus",
    "week",
  ]);
  assert.throws(() => updateWorkspace(state, { theme: "unknown" }));
});
test("侧栏显示与新手教程偏好可升级、可校验且不影响组件", () => {
  const original = initialWorkspace();
  const configured = updateWorkspace(original, {
    navigation: { collapsed: true, hidden: ["calendar", "insights"] },
    onboardingVersion: 1,
  });
  assert.equal(configured.navigation.collapsed, true);
  assert.deepEqual(configured.navigation.hidden, ["calendar", "insights"]);
  assert.equal(configured.onboardingVersion, 1);
  assert.throws(() => updateWorkspace(configured, { navigation: { hidden: ["../bad"] } }));
  assert.throws(() => updateWorkspace(configured, { onboardingVersion: -1 }));
  assert.deepEqual(original.navigation, { collapsed: false, hidden: [] });
});
test("备份恢复包含主题、组件顺序和独立数据；未安装组件的数据保留", () => {
  const s = initialState();
  s.workspace = saveWidgetData(
    updateWorkspace(s.workspace, {
      theme: "paper",
      widgets: { order: ["future-widget", "priority"], hidden: ["priority"] },
    }),
    { id: "future-widget", version: 4, data: { draft: "保留" } },
  );
  assert.deepEqual(validateState(s).workspace, s.workspace);
});
test("注册器拒绝冲突，跳过不兼容扩展，内置模块仍可用", () => {
  const registry = createRegistry(
    [module],
    [{ ...widget, id: "other-widget", apiVersion: 9 }, widget],
  );
  assert.equal(registry.issues.length, 2);
  assert.equal(registry.widgets.size, 1);
  assert.throws(() => createRegistry([module, module]));
  assert.throws(() =>
    createRegistry([module, { ...module, id: "other-module" }]),
  );
});
test("小组件只获得声明的数据和操作，不能调用学校登录或备份权限", async () => {
  const state = { tasks: [], campusAuth: { secret: "not-exposed" }, logs: [] };
  const calls = [];
  const services = widgetServices(widget, state, {
    call: async (...args) => calls.push(args),
  });
  assert.deepEqual(Object.keys(services.data), ["tasks"]);
  assert.equal(services.data.campusAuth, undefined);
  await services.actions.call("task.complete", { id: "x" });
  assert.equal(calls.length, 1);
  await assert.rejects(
    () => services.actions.call("school.login.configure", {}),
    /未声明/,
  );
  await services.actions.configure({ count: 1 });
  assert.deepEqual(calls[1], [
    "widget.configure",
    { id: "demo-widget", version: 1, data: { count: 1 } },
  ]);
});
test("组件升级链不修改旧数据；缺失升级步骤和降级被拒绝", () => {
  const old = { version: 1, data: { count: 3 } };
  const next = {
    ...widget,
    stateVersion: 3,
    migrations: {
      2: (d) => ({ ...d, label: "新字段" }),
      3: (d) => ({ ...d, count: d.count + 1 }),
    },
  };
  assert.deepEqual(migrateWidgetData(next, old), {
    version: 3,
    data: { count: 4, label: "新字段" },
  });
  assert.equal(old.data.count, 3);
  assert.throws(
    () => migrateWidgetData({ ...next, migrations: {} }, old),
    /升级步骤/,
  );
  assert.throws(
    () => migrateWidgetData(widget, { version: 2, data: {} }),
    /更新版本/,
  );
});
test("无效组件配置、过大数据和原型字段被拒绝，隐藏项不渲染", () => {
  assert.throws(() =>
    saveWidgetData(initialWorkspace(), { id: "../bad", version: 1, data: {} }),
  );
  assert.throws(() =>
    saveWidgetData(initialWorkspace(), {
      id: "demo-widget",
      version: 1,
      data: { large: "x".repeat(25000) },
    }),
  );
  assert.throws(() =>
    saveWidgetData(initialWorkspace(), {
      id: "demo-widget",
      version: 1,
      data: JSON.parse('{"__proto__":{}}'),
    }),
  );
  const registry = createRegistry([module]);
  const ws = workspaceInput({
    ...initialWorkspace(),
    widgets: {
      order: ["demo-widget", "missing-widget"],
      hidden: ["demo-widget"],
    },
  });
  assert.deepEqual(widgetLayout(ws, registry), []);
});
test("桌面命令注册拒绝未知及重复操作，命令上下文正确传递", async () => {
  const seen = [];
  const router = makeRouter(
    [
      {
        names: ["demo"],
        execute: async (action, p, context) =>
          seen.push([action, p, context.value]),
      },
    ],
    { value: 7 },
  );
  await router.execute("demo", { n: 1 });
  assert.deepEqual(seen, [["demo", { n: 1 }, 7]]);
  assert.throws(() => router.execute("constructor", {}));
  assert.throws(() =>
    makeRouter([{ names: ["demo", "demo"], execute() {} }], {}),
  );
  assert.throws(() => router.execute("demo", null));
});
test("主进程工作台命令是独立事务，坏配置不改变状态", async () => {
  const store = new Store(
    fs.mkdtempSync(path.join(os.tmpdir(), "veritas-platform-")),
  );
  const router = createCommandRouter({ store });
  await router.execute("workspace.configure", { theme: "paper" });
  await router.execute("widget.configure", {
    id: "quick-note",
    version: 1,
    data: { text: "draft" },
  });
  await assert.rejects(() =>
    router.execute("workspace.configure", { theme: "invalid" }),
  );
  assert.equal(store.state.workspace.theme, "paper");
  await router.execute("workspace.reset");
  assert.equal(
    store.state.workspace.widgetData["quick-note"].data.text,
    "draft",
  );
});
