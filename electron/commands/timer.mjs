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
  if (action === "timer")
    store.change((s) => domain.timerAction(s, p.action, p));
}
