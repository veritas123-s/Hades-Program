import { THEMES } from "./catalog.mjs";
export const ASSET_ID = /^[a-f0-9]{64}\.png$/;
const hex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export const defaultAppearance = () => ({
  image: "default",
  opacity: 22,
  blur: 0,
  position: "center",
  fit: "cover",
});
export function appearanceInput(value = {}) {
  const a = { ...defaultAppearance(), ...value };
  if (!["default", "none"].includes(a.image) && !ASSET_ID.test(a.image))
    throw Error("背景图标识无效");
  if (
    !Number.isFinite(a.opacity) ||
    a.opacity < 0 ||
    a.opacity > 60 ||
    !Number.isFinite(a.blur) ||
    a.blur < 0 ||
    a.blur > 16 ||
    !["center", "top", "bottom", "left", "right"].includes(a.position) ||
    !["cover", "contain"].includes(a.fit)
  )
    throw Error("背景图设置无效");
  return Object.fromEntries(
    Object.keys(defaultAppearance()).map((k) => [k, a[k]]),
  );
}
export function customThemesInput(items = []) {
  if (!Array.isArray(items) || items.length > 30)
    throw Error("最多保存30个自定义主题");
  const ids = new Set();
  return items.map((x) => {
    if (
      !/^custom-[a-z0-9-]{5,64}$/.test(x.id) ||
      ids.has(x.id) ||
      typeof x.name !== "string" ||
      !x.name.trim() ||
      x.name.length > 40 ||
      !THEMES.some((t) => t.id === x.base)
    )
      throw Error("自定义主题名称或标识无效");
    ids.add(x.id);
    if (
      !x.colors ||
      !["accent", "background", "surface", "text"].every((k) =>
        hex(x.colors[k]),
      )
    )
      throw Error("主题颜色必须是六位十六进制颜色");
    return {
      id: x.id,
      name: x.name.trim(),
      base: x.base,
      colors: Object.fromEntries(
        ["accent", "background", "surface", "text"].map((k) => [
          k,
          x.colors[k],
        ]),
      ),
      appearance: appearanceInput(x.appearance),
      deletedAt: Number.isFinite(x.deletedAt) ? x.deletedAt : null,
    };
  });
}
export function onColor(hexColor) {
  const rgb = hexColor
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179
    ? "#17212b"
    : "#ffffff";
}
