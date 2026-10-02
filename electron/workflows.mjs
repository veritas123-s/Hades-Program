import { sameNotice, noticeAliases } from "../src/learning-policy.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { taskInput } from "../src/domain/tasks.mjs";
export const learningTaskId = (id) =>
  "cx-" + createHash("sha256").update(id).digest("hex").slice(0, 24);
export class Workflows {
  constructor(directory) {
    this.file = path.join(directory, "medstack-workflows.json");
    const legacyFile = path.join(directory, Buffer.from("aGFkZXMtd29ya2Zsb3dzLmpzb24=", "base64").toString());
    if (!fs.existsSync(this.file) && fs.existsSync(legacyFile)) fs.copyFileSync(legacyFile, this.file);
    this.data = {
      version: 1,
      autoImport: true,
      autoCommit: false,
      includeArchived: false,
      read: [],
      noticeArchive: [],
      assignmentArchive: [],
      courseChoices: {},
      audit: [],
      links: {},
    };
    if (fs.existsSync(this.file)) {
      try {
        const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (
          d.version !== 1 ||
          !Array.isArray(d.read) ||
          !Array.isArray(d.audit)
        )
          throw Error();
        if (
          d.noticeArchive !== undefined &&
          (!Array.isArray(d.noticeArchive) ||
            d.noticeArchive.some(
              (x) =>
                !x?.item ||
                x.item.kind !== "notice" ||
                typeof x.item.id !== "string" ||
                !Number.isFinite(x.deletedAt),
            ))
        )
          throw Error();
        if (
          d.assignmentArchive !== undefined &&
          (!Array.isArray(d.assignmentArchive) ||
            d.assignmentArchive.some(
              (e) =>
                e?.item?.kind !== "assignment" ||
                typeof e.item.id !== "string" ||
                !Number.isFinite(e.deletedAt),
            ))
        )
          throw Error();
        if (
          d.courseChoices !== undefined &&
          (!d.courseChoices ||
            Array.isArray(d.courseChoices) ||
            Object.entries(d.courseChoices).some(
              ([key, v]) =>
                !/^\d+:\d+$/.test(key) ||
                !["auto", "follow", "hide"].includes(v),
            ))
        )
          throw Error();
        this.data = { ...this.data, ...d };
      } catch {
        this.locked = true;
      }
    }
  }
  save() {
    if (this.locked) throw Error("工作流配置无法读取，原文件已保留");
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.data), {
      mode: 0o600,
    });
    fs.renameSync(this.file + ".tmp", this.file);
  }
  configure(p) {
    if (this.locked) throw Error("工作流配置无法读取，原文件已保留");
    const previous = structuredClone(this.data);
    try {
      for (const k of ["autoImport", "autoCommit", "includeArchived"])
        if (typeof p[k] === "boolean") this.data[k] = p[k];
      if (p.courseChoice) {
        const { key, value } = p.courseChoice;
        if (
          !/^\d+:\d+$/.test(key) ||
          !["auto", "follow", "hide"].includes(value)
        )
          throw Error("课程关注设置无效");
        this.data.courseChoices = { ...this.data.courseChoices, [key]: value };
      }
      this.save();
    } catch (e) {
      this.data = previous;
      throw e;
    }
  }
  mark(ids) {
    this.data.read = [
      ...new Set([
        ...this.data.read,
        ...ids.filter((x) => typeof x === "string" && x.length < 300),
      ]),
    ].slice(-2000);
    this.save();
  }
  notices(ids, items, restore = false) {
    if (this.locked) throw Error("工作流配置无法读取，原文件已保留");
    const wanted = new Set(
      ids.filter((x) => typeof x === "string" && x.length < 300),
    );
    const previous = structuredClone(this.data);
    try {
      const archive = new Map(
        this.data.noticeArchive.map((x) => [x.item.id, x]),
      );
      const targets = [...archive.values()]
        .map((e) => e.item)
        .concat(items)
        .filter(
          (x) =>
            x.kind === "notice" &&
            noticeAliases(x).some((id) => wanted.has(id)),
        );
      for (const item of targets) {
        const matches = [...archive.values()].filter((e) =>
          sameNotice(e.item, item),
        );
        const record = matches[0] || { item, deletedAt: 0 };
        record.deletedAt = restore ? 0 : Date.now();
        record.item = {
          ...record.item,
          ...item,
          aliases: [
            ...new Set([
              ...noticeAliases(item),
              ...matches.flatMap((e) => noticeAliases(e.item)),
            ]),
          ],
        };
        for (const [key, entry] of archive)
          if (matches.includes(entry)) archive.delete(key);
        archive.set(record.item.id, record);
      }
      this.data.noticeArchive = [...archive.values()];
      this.save();
    } catch (error) {
      this.data = previous;
      throw error;
    }
  }
  assignments(ids, items, store, restore = false) {
    if (this.locked) throw Error("工作流配置无法读取，原文件已保留");
    const wanted = new Set(ids),
      previous = structuredClone(this.data);
    const records = new Map(
      this.data.assignmentArchive.map((e) => [e.item.id, e]),
    );
    const targets = new Map(
      [...this.data.assignmentArchive.map((e) => e.item), ...items]
        .filter((x) => x.kind === "assignment" && wanted.has(x.id))
        .map((x) => [x.id, x]),
    );
    if (!targets.size) return;
    for (const item of targets.values())
      records.set(item.id, { item, deletedAt: restore ? 0 : Date.now() });
    this.data.assignmentArchive = [...records.values()];
    try {
      this.save();
      store.change((s) => {
        for (const item of targets.values()) {
          const task = s.tasks.find((t) => t.id === learningTaskId(item.id));
          if (task) task.deletedAt = restore ? null : Date.now();
        }
      });
    } catch (e) {
      this.data = previous;
      this.save();
      throw e;
    }
  }
  record(kind, ids) {
    if (!ids.length) return;
    this.data.audit = [
      { id: randomUUID(), at: Date.now(), kind, ids, undone: false },
      ...this.data.audit,
    ].slice(0, 100);
    this.save();
  }
  importLearning(items, store) {
    if (!this.data.autoImport || this.locked) return 0;
    const links = this.data.links || {};
    // Refresh source-owned deadline fields only while the user has not edited them.
    const updates = items
      .filter(
        (x) =>
          x.kind === "assignment" &&
          x.deadline &&
          !x.estimated &&
          !x.yearInferred &&
          links[learningTaskId(x.id)],
      )
      .map((x) => {
        const id = learningTaskId(x.id),
          old = links[id],
          t = store.state.tasks.find(
            (t) => t.id === id && !t.deletedAt && !t.completedAt,
          );
        const dt = new Date(x.deadline + 8 * 3600000).toISOString(),
          due = dt.slice(0, 10),
          dueTime = dt.slice(11, 16);
        return t &&
          t.due === old.due &&
          t.dueTime === old.dueTime &&
          (t.due !== due || t.dueTime !== dueTime)
          ? { id, due, dueTime }
          : null;
      })
      .filter(Boolean);
    if (updates.length) {
      store.change((s) => {
        for (const u of updates)
          Object.assign(
            s.tasks.find((t) => t.id === u.id),
            { due: u.due, dueTime: u.dueTime },
          );
      });
      for (const u of updates) links[u.id] = { due: u.due, dueTime: u.dueTime };
      this.data.links = links;
      this.save();
    }
    const fresh = items.filter(
      (x) =>
        x.kind === "assignment" &&
        !x.done &&
        !x.closed &&
        !(this.data.assignmentArchive || []).some(
          (e) => e.item.id === x.id && e.deletedAt,
        ) &&
        !store.state.tasks.some((t) => t.id === learningTaskId(x.id)),
    );
    if (!fresh.length) return 0;
    const tasks = fresh.map((x) => {
      const dt =
        x.deadline && !x.estimated && !x.yearInferred
          ? new Date(x.deadline + 8 * 3600000).toISOString()
          : "";
      return taskInput(
        {
          title: x.title,
          project: x.course,
          quadrant:
            dt && x.deadline < Date.now() + 3 * 86400000 ? "do" : "plan",
          due: dt.slice(0, 10),
          dueTime: dt.slice(11, 16),
          notes:
            "来源：学习通。提交情况及截止时间请以课程平台为准。" +
            (x.yearInferred
              ? "平台只提供月日，年份按当前最近日期推定，请核对。"
              : "") +
            (x.estimated
              ? "平台仅提供倒计时，估算截止时间见通知中心；核对后可手动设置。"
              : ""),
        },
        { id: learningTaskId(x.id) },
      );
    });
    store.change((s) => {
      s.tasks.push(...tasks);
    });
    for (const t of tasks) links[t.id] = { due: t.due, dueTime: t.dueTime };
    this.data.links = links;
    this.record(
      "学习通作业入库",
      tasks.map((t) => t.id),
    );
    return tasks.length;
  }
  undo(id, store) {
    const a = this.data.audit.find((x) => x.id === id && !x.undone);
    if (!a) throw Error("该记录已撤销或不存在");
    store.change((s) => {
      for (const t of s.tasks)
        if (a.ids.includes(t.id) && !t.deletedAt && !t.completedAt)
          t.deletedAt = Date.now();
    });
    a.undone = true;
    this.save();
  }
}
