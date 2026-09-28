import { THEMES } from "../themes/catalog.mjs";
import {
  appearanceInput,
  customThemesInput,
  defaultAppearance,
} from "../themes/custom.mjs";
export const HOST_API_VERSION = 1;
export const DEFAULT_WIDGET_ORDER = ["priority", "focus", "week", "courses"];
export const validId = (id) =>
  typeof id === "string" &&
  /^[a-z][a-z0-9-]{1,47}$/.test(id) &&
  !["constructor", "prototype"].includes(id);
export function initialWorkspace() {
  return {
    version: 1,
    theme: "monument",
    appearance: defaultAppearance(),
    customThemes: [],
    widgets: { order: [...DEFAULT_WIDGET_ORDER], hidden: [], sizes: {} },
    widgetData: {},
  };
}
function idList(input) {
  if (
    !Array.isArray(input) ||
    input.length > 100 ||
    input.some((x) => !validId(x))
  )
    throw new Error("小组件列表无效");
  return [...new Set(input)];
}
export function safeWidgetData(value) {
  const encoded = JSON.stringify(value);
  if (!encoded || encoded.length > 20000)
    throw new Error("小组件数据过大或无效");
  const visit = (v, depth = 0) => {
    if (depth > 12) throw new Error("小组件数据层级过深");
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    if (
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw new Error("小组件字段无效");
        visit(x, depth + 1);
      }
      return;
    }
    throw new Error("小组件数据必须是 JSON");
  };
  visit(value);
  return JSON.parse(encoded);
}
export function workspaceInput(input) {
  if (input === undefined) return initialWorkspace();
  if (!input || input.version !== 1) throw new Error("工作台配置版本不支持");
  const result = initialWorkspace();
  result.appearance = appearanceInput(input.appearance);
  result.customThemes = customThemesInput(input.customThemes);
  result.theme =
    THEMES.some((t) => t.id === input.theme) ||
    result.customThemes.some((t) => t.id === input.theme && !t.deletedAt)
      ? input.theme
      : "monument";
  if (input.widgets) {
    result.widgets.order = idList(input.widgets.order ?? DEFAULT_WIDGET_ORDER);
    result.widgets.hidden = idList(input.widgets.hidden ?? []);
    const sizes = input.widgets.sizes ?? {};
    if (
      !sizes ||
      typeof sizes !== "object" ||
      Array.isArray(sizes) ||
      Object.keys(sizes).length > 100
    )
      throw new Error("小组件尺寸无效");
    for (const [id, size] of Object.entries(sizes)) {
      if (!validId(id) || !["half", "full"].includes(size))
        throw new Error("小组件尺寸无效");
      result.widgets.sizes[id] = size;
    }
  }
  if (input.widgetData) {
    if (
      typeof input.widgetData !== "object" ||
      Array.isArray(input.widgetData) ||
      Object.keys(input.widgetData).length > 100
    )
      throw new Error("小组件存储无效");
    for (const [id, record] of Object.entries(input.widgetData)) {
      if (
        !validId(id) ||
        !Number.isInteger(record?.version) ||
        record.version < 1 ||
        record.version > 1000
      )
        throw new Error("小组件存储版本无效");
      result.widgetData[id] = {
        version: record.version,
        data: safeWidgetData(record.data),
      };
    }
  }
  if (JSON.stringify(result).length > 250000) throw new Error("工作台配置过大");
  return result;
}
export function updateWorkspace(current, patch) {
  const next = structuredClone(current);
  if (patch.customThemes !== undefined)
    next.customThemes = customThemesInput(patch.customThemes);
  if (patch.appearance !== undefined)
    next.appearance = appearanceInput({
      ...next.appearance,
      ...patch.appearance,
    });
  if (patch.theme !== undefined) {
    if (
      !THEMES.some((t) => t.id === patch.theme) &&
      !next.customThemes.some((t) => t.id === patch.theme && !t.deletedAt)
    )
      throw new Error("主题不存在");
    next.theme = patch.theme;
  }
  if (patch.widgets !== undefined)
    next.widgets = { ...next.widgets, ...patch.widgets };
  return workspaceInput(next);
}
export function saveWidgetData(current, { id, version, data }) {
  if (!validId(id)) throw new Error("小组件标识无效");
  const prior = current.widgetData[id];
  if (prior && version < prior.version)
    throw new Error("不能覆盖较新版本的小组件数据");
  return workspaceInput({
    ...current,
    widgetData: { ...current.widgetData, [id]: { version, data } },
  });
}
