import { HOST_API_VERSION, validId, safeWidgetData } from "./model.mjs";
const DATA_KEYS = [
  "tasks",
  "logs",
  "settings",
  "timer",
  "cycles",
  "courses",
  "courseRanges",
  "scores",
];
const WIDGET_COMMANDS = [
  "task.save",
  "task.complete",
  "task.delete",
  "task.restore",
  "timer",
];
const UI_ACTIONS = ["navigate", "addTask", "editTask", "focusTask"];
export function validateWidget(widget) {
  if (
    !widget ||
    !validId(widget.id) ||
    typeof widget.title !== "string" ||
    !widget.title.trim() ||
    widget.title.length > 60
  )
    throw new Error("小组件名称或标识无效");
  if (widget.apiVersion !== HOST_API_VERSION)
    throw new Error("小组件与当前工作台不兼容");
  if (typeof widget.Component !== "function") throw new Error("小组件缺少界面");
  if (!Number.isInteger(widget.stateVersion) || widget.stateVersion < 1)
    throw new Error("小组件缺少数据版本");
  for (const [key, allow] of [
    ["data", DATA_KEYS],
    ["commands", WIDGET_COMMANDS],
    ["uiActions", UI_ACTIONS],
  ]) {
    if (
      !Array.isArray(widget[key]) ||
      widget[key].some((x) => !allow.includes(x))
    )
      throw new Error("小组件能力声明无效");
  }
  return widget;
}
export function createRegistry(modules, extensions = []) {
  const routes = new Map(),
    widgets = new Map(),
    ids = new Set(),
    issues = [];
  for (const module of modules) {
    if (
      !validId(module.id) ||
      ids.has(module.id) ||
      module.apiVersion !== HOST_API_VERSION
    )
      throw new Error("模块注册无效或重复");
    ids.add(module.id);
    for (const route of module.routes || []) {
      if (!validId(route.id) || routes.has(route.id) || !route.Component)
        throw new Error("页面标识重复或无效");
      routes.set(route.id, { ...route, moduleId: module.id });
    }
    for (const widget of module.widgets || []) {
      validateWidget(widget);
      if (widgets.has(widget.id)) throw new Error("小组件重复注册");
      widgets.set(widget.id, { ...widget, moduleId: module.id });
    }
  }
  // Optional bundled extensions cannot override the built-in registry.
  for (const extension of extensions) {
    try {
      validateWidget(extension);
      if (widgets.has(extension.id)) throw new Error("标识已被占用");
      widgets.set(extension.id, { ...extension, moduleId: "extensions" });
    } catch (error) {
      issues.push({
        id: String(extension?.id || "unknown"),
        message: error.message,
      });
    }
  }
  return { modules, routes, widgets, issues };
}
export function widgetLayout(workspace, registry) {
  return workspace.widgets.order.filter(
    (id) => registry.widgets.has(id) && !workspace.widgets.hidden.includes(id),
  );
}
export function migrateWidgetData(definition, record) {
  if (!record)
    return {
      version: definition.stateVersion,
      data: safeWidgetData(definition.defaults || {}),
    };
  if (record.version > definition.stateVersion)
    throw new Error("此小组件数据来自更新版本，请更新组件后再打开。");
  let data = safeWidgetData(record.data);
  for (
    let version = record.version + 1;
    version <= definition.stateVersion;
    version++
  ) {
    const migrate = definition.migrations?.[version];
    if (typeof migrate !== "function")
      throw new Error("此小组件缺少数据升级步骤，原数据已保留。");
    data = safeWidgetData(migrate(data));
  }
  return { version: definition.stateVersion, data };
}
export function widgetServices(definition, state, host) {
  const data = Object.fromEntries(
    definition.data.map((key) => [key, state[key]]),
  );
  const actions = {
    call: (command, payload) => {
      if (!definition.commands.includes(command))
        return Promise.reject(new Error("小组件未声明此操作"));
      return host.call(command, payload);
    },
    configure: (data) =>
      host.call("widget.configure", {
        id: definition.id,
        version: definition.stateVersion,
        data,
      }),
  };
  for (const action of definition.uiActions) actions[action] = host[action];
  return { data, actions };
}
