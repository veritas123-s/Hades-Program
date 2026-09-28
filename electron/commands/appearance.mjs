export default async function execute(
  action,
  p,
  { dialog, getWindow, themeAssets, store },
) {
  if (action === "background.import") {
    const selected = await dialog.showOpenDialog(getWindow(), {
      title: "选择主题背景图",
      properties: ["openFile"],
      filters: [{ name: "背景图", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (selected.canceled) return { canceled: true };
    const image = themeAssets.importFile(selected.filePaths[0]);
    store.change((s) => {
      s.workspace.appearance = { ...s.workspace.appearance, image };
    });
  }
}
