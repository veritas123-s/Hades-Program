export default async function execute(
  action,
  payload,
  { mail, store, domain, broadcast },
) {
  if (action === "mail.connect") return mail.connect(payload);
  if (action === "mail.refresh") return mail.refresh();
  if (action === "mail.read") return mail.read(payload);
  if (action === "mail.disconnect") {
    mail.disconnect();
    broadcast();
    return mail.status();
  }
  if (action === "mail.task") {
    const status = mail.status();
    const item = status.items.find(
      (x) => x.uid === payload.uid && x.validity === payload.validity,
    );
    if (!item) throw Error("请刷新后选择邮件");
    const source = `交大邮箱 · ${status.username}@sjtu.edu.cn · INBOX · ${item.validity}/${item.uid}`;
    const notes = `${source}\n发件人：${item.from}\n邮件日期：${item.date || "未知"}`;
    const previous = store.state.tasks.find(
      (x) => !x.deletedAt && x.notes?.startsWith(source + "\n"),
    );
    if (previous) return { taskId: previous.id, existing: true };
    const task = domain.taskInput({
      title: item.subject,
      quadrant: "plan",
      project: "收集箱",
      notes,
    });
    store.change((s) => s.tasks.push(task));
    broadcast();
    return { taskId: task.id, existing: false };
  }
  return mail.status();
}
