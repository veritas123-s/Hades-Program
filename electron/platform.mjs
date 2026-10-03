export function releasePlatform(
  platform = process.platform,
  arch = process.arch,
) {
  if (platform === "win32") return "windows";
  if (platform === "darwin" && ["x64", "arm64"].includes(arch))
    return `macos_${arch}`;
  return null;
}

// Roles provide native macOS shortcuts, text editing and accessibility labels.
export function macMenuTemplate(name, show, openHelp) {
  return [
    {
      label: name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "显示",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { label: "打开工作台", click: show },
        { role: "front" },
      ],
    },
    {
      role: "help",
      submenu: [
        { label: "使用说明", click: () => openHelp("user") },
        { label: "开发者手册", click: () => openHelp("developer") },
      ],
    },
  ];
}
