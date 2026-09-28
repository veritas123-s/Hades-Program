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
  } = context;
  const win = context.getWindow();
  if (action.startsWith("briefing.cloud.")) {
    const cloud = bridge.onboarding;
    switch (action) {
      case "briefing.cloud.state":
        return cloud.status();
      case "briefing.cloud.login":
        await cloud.signIn();
        break;
      case "briefing.cloud.logout":
        cloud.signOut();
        break;
      case "briefing.cloud.bind":
        cloud.bind(p);
        break;
      case "briefing.cloud.open":
        await cloud.open(p.which);
        break;
      case "briefing.cloud.deploy":
        await cloud.deploy(p);
        break;
      case "briefing.cloud.test":
        await cloud.testMessage();
        break;
      case "briefing.cloud.received":
        cloud.confirmReceived();
        break;
    }
    return cloud.status();
  }
  if (action === "briefing.sync.configure") {
    bridge.sync.configure(p);
    bridge.export(store.state, true);
    return bridge.snapshot(store.state, p.date);
  } else if (action === "briefing.sync.now") {
    bridge.export(store.state, true);
    await bridge.sync.flush();
    return bridge.snapshot(store.state, p.date);
  } else if (action === "briefing.sync.disconnect") {
    bridge.sync.disconnect();
    return bridge.snapshot(store.state, p.date);
  }
  if (action === "briefing.state") {
    bridge.export(store.state);
    return bridge.snapshot(store.state, p.date);
  } else if (action === "briefing.export") {
    bridge.export(store.state, true);
    broadcast();
    return bridge.snapshot(store.state, p.date);
  } else if (action === "briefing.choose") {
    if (!["sharedRoot", "cloudDirectory"].includes(p.kind))
      throw new Error("目录类型无效");
    const result = await dialog.showOpenDialog(win, {
      title:
        p.kind === "sharedRoot"
          ? "选择共享助理根目录"
          : "选择快报 cloud_morning 目录",
      properties: ["openDirectory"],
    });
    if (result.canceled) return { canceled: true };
    const chosen = result.filePaths[0];
    if (
      p.kind === "sharedRoot" &&
      !fs.existsSync(path.join(chosen, "reminders", "reminders.json"))
    )
      throw new Error("所选目录没有 reminders/reminders.json");
    if (
      p.kind === "cloudDirectory" &&
      !fs.existsSync(path.join(chosen, "index.py"))
    )
      throw new Error("所选目录没有快报 index.py");
    bridge.configure({ [p.kind]: chosen });
    bridge.export(store.state, true);
    return bridge.snapshot(store.state);
  } else if (action === "briefing.folder") {
    await shell.openPath(path.join(app.getPath("userData"), "briefing"));
    return { ok: true };
  }
}
