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
  if (action === "settings")
    store.change((s) => {
      s.settings = domain.settingsInput(p);
      if (s.timer.status === "idle")
        s.timer = domain.emptyTimer(s.settings, s.timer.mode);
    });
  else if (action === "notice.dismiss")
    store.change((s) => {
      s.lastNotice = "";
    });
}
