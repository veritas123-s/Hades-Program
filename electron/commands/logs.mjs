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
  if (action === "log.add")
    store.change((s) => {
      const start = Date.parse(p.start),
        end = Date.parse(p.end);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        end - start > 86400000 ||
        end > Date.now() + 60000
      )
        throw new Error("请输入过去的有效起止时间，单条记录不超过 24 小时");
      if (
        s.logs.some(
          (l) =>
            !l.deletedAt &&
            l.segments.some((t) => start < t.end && end > t.start),
        ) ||
        s.timer.segments.some((t) => start < t.end && end > t.start) ||
        (s.timer.status === "running" && end > s.timer.activeSince)
      )
        throw new Error("与已有工作时间重叠，请调整起止时间");
      s.logs.push({
        id: domain.uid(),
        title: String(p.title || "手动补记").slice(0, 300),
        project: String(p.project || "未分类").slice(0, 60),
        taskId: "",
        mode: "manual",
        startedAt: start,
        endedAt: end,
        durationMs: end - start,
        completed: false,
        segments: [{ start, end }],
        deletedAt: null,
      });
    });
  else if (action === "log.delete" || action === "log.restore")
    store.change((s) => {
      const log = s.logs.find((l) => l.id === p.id);
      if (!log) throw new Error("记录不存在");
      log.deletedAt = action === "log.delete" ? Date.now() : null;
    });
}
