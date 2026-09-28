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
  if (action === "task.save")
    store.change((s) => {
      const old = s.tasks.find((t) => t.id === p.id);
      const task = domain.taskInput(p, old);
      if (old) Object.assign(old, task);
      else s.tasks.push(task);
    });
  else if (action === "task.complete")
    store.change((s) => domain.completeTask(s, p.id));
  else if (action === "task.delete" || action === "task.restore")
    store.change((s) => {
      const t = s.tasks.find((x) => x.id === p.id);
      if (!t) throw new Error("任务不存在");
      t.deletedAt = action === "task.delete" ? Date.now() : null;
    });
}
