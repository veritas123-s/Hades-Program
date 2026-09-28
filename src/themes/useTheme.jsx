import { useLayoutEffect } from "react";
import { themeById } from "./catalog.mjs";
import { WALLPAPERS } from "./wallpapers.mjs";
import { onColor } from "./custom.mjs";
export function useTheme(workspace) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const custom = workspace?.customThemes?.find(
      (t) => t.id === workspace.theme && !t.deletedAt,
    );
    const base = themeById(custom?.base || workspace?.theme).id;
    root.dataset.theme = base;
    for (const key of [
      "text",
      "muted",
      "bg",
      "surface",
      "surface-soft",
      "border",
      "accent",
      "green",
      "on-accent",
    ])
      root.style.removeProperty("--" + key);
    if (custom) {
      const c = custom.colors;
      Object.entries({
        text: c.text,
        muted: `color-mix(in srgb, ${c.text} 70%, ${c.surface})`,
        bg: c.background,
        surface: c.surface,
        "surface-soft": `color-mix(in srgb, ${c.background} 60%, ${c.surface})`,
        border: `color-mix(in srgb, ${c.text} 18%, ${c.surface})`,
        accent: c.accent,
        green: c.accent,
        "on-accent": onColor(c.accent),
      }).forEach(([k, v]) => root.style.setProperty("--" + k, v));
    }
    const a = workspace?.appearance || {
      image: "default",
      opacity: 22,
      blur: 0,
      position: "center",
      fit: "cover",
    };
    const image =
      a.image === "none"
        ? ""
        : a.image === "default"
          ? WALLPAPERS[base] || ""
          : `veritas://app/user-backgrounds/${a.image}`;
    root.style.setProperty("--theme-art", image ? `url("${image}")` : "none");
    root.style.setProperty("--art-opacity", String(a.opacity / 100));
    root.style.setProperty("--art-blur", a.blur + "px");
    root.style.setProperty("--art-position", a.position);
    root.style.setProperty("--art-fit", a.fit);
    root.dataset.wallpaper = image ? "yes" : "no";
  }, [workspace?.theme, workspace?.appearance, workspace?.customThemes]);
}
