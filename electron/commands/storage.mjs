export default async function execute(action, p, context) {
  const {
    store,
    domain,
    campus,
    auth,
    bridge,
    dialog,
    shell,
    app,
    fs,
    path,
    broadcast,
    themeAssets,
  } = context;
  const win = context.getWindow();
  if (action === "export.backup" || action === "export.csv") {
    const csv = action === "export.csv";
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `Hades-${domain.dayKey()}.${csv ? "csv" : "json"}`,
      filters: [
        {
          name: csv ? "工作记录 CSV" : "完整备份 JSON",
          extensions: [csv ? "csv" : "json"],
        },
      ],
    });
    if (result.canceled) return { canceled: true };
    fs.writeFileSync(
      result.filePath,
      csv
        ? domain.csvLogs(store.state.logs)
        : JSON.stringify(
            { ...store.state, themeAssets: themeAssets.export(store.state) },
            null,
            2,
          ),
      "utf8",
    );
    return { ok: true };
  } else if (action === "import.backup") {
    if (store.state.timer.status !== "idle")
      throw new Error("请先结束当前计时，再恢复备份");
    const file = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "完整备份 JSON", extensions: ["json"] }],
    });
    if (file.canceled) return { canceled: true };
    if (fs.statSync(file.filePaths[0]).size > 400_000_000)
      throw new Error("备份文件过大");
    const raw = JSON.parse(fs.readFileSync(file.filePaths[0], "utf8"));
    const next = domain.validateState(raw);
    const restoreAssets = themeAssets.prepareRestore(raw, next);
    domain.recoverTimer(next);
    const check = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["取消", "备份现有数据并恢复"],
      defaultId: 0,
      cancelId: 0,
      message: `恢复 ${next.tasks.length} 个任务、${next.logs.length} 条记录？`,
      detail: "现有内容会替换，替换前自动保存一份完整备份。",
    });
    if (check.response !== 1) return { canceled: true };
    store.backup();
    restoreAssets();
    store.commit(next);
  } else if (action === "data.folder") {
    await shell.openPath(path.dirname(store.file));
    return { ok: true };
  } else throw new Error("不支持的操作");
}
