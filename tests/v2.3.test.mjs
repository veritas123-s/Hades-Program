import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initialState } from "../src/domain.mjs";
import {
  courseRelevance,
  assignmentDisposition,
  learningSelection,
  mergeNotices,
} from "../src/learning-policy.mjs";
import { parseNotices } from "../electron/learning-parser.mjs";
import { Workflows, learningTaskId } from "../electron/workflows.mjs";
import { Store } from "../electron/store.mjs";
import { assistantContext } from "../src/assistant.mjs";
import { agenda } from "../src/agenda.mjs";
const now = Date.parse("2026-09-28T12:00:00+08:00"),
  DAY = 86400000;
const course = { key: "1:2", title: "合成课程", archived: false };
const work = {
  id: "work:1:2:3",
  courseKey: course.key,
  course: course.title,
  title: "合成作业",
  kind: "assignment",
  taskId: learningTaskId("work:1:2:3"),
  done: false,
};
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "medstack23-unit-"));
test("未归档不能证明是当前课程，明确年份、近期课表与手动关注可确认", () => {
  const s = initialState(),
    l = { courses: [course], catalogComplete: true };
  assert.equal(courseRelevance(course, s, now).code, "unknown");
  assert.equal(assignmentDisposition(work, s, l, now).active, false);
  assert.equal(
    assignmentDisposition(
      { ...work, deadline: now + DAY, yearInferred: true },
      s,
      l,
      now,
    ).active,
    false,
  );
  assert.equal(
    assignmentDisposition({ ...work, deadline: now + DAY }, s, l, now).active,
    true,
  );
  s.courses = [{ title: course.title, start: "2026-09-28T14:00:00" }];
  assert.equal(assignmentDisposition(work, s, l, now).active, true);
  s.workflows = { courseChoices: { "1:2": "hide" } };
  assert.equal(
    assignmentDisposition({ ...work, deadline: now + DAY }, s, l, now).active,
    false,
  );
  s.workflows.courseChoices["1:2"] = "follow";
  assert.equal(
    courseRelevance({ ...course, archived: true }, s, now).active,
    true,
  );
});
test("已提交、截止、过期、往年学年、归档与离开目录的作业进入历史", () => {
  const s = initialState(),
    l = { courses: [course], catalogComplete: true };
  for (const patch of [
    { done: true },
    { closed: true },
    { deadline: now - 15 * DAY },
    { deadline: now + 181 * DAY },
  ])
    assert.equal(
      assignmentDisposition({ ...work, ...patch }, s, l, now).active,
      false,
    );
  for (const patch of [{ title: "合成课程 2025-2026" }, { archived: true }])
    assert.equal(
      assignmentDisposition(
        { ...work, deadline: now + DAY },
        s,
        { ...l, courses: [{ ...course, ...patch }] },
        now,
      ).active,
      false,
    );
  assert.equal(
    assignmentDisposition(
      { ...work, deadline: now + DAY },
      s,
      { ...l, courses: [] },
      now,
    ).code,
    "removed",
  );
});
test("通知时间秒毫秒一致，无发布时间不得被刷新为今天", () => {
  const result = parseNotices(
    {
      status: true,
      notices: {
        list: [
          { id: 1, uuid: "stable", title: "通知", completeTime: now / 1000 },
          { id: 2, title: "通知", completeTime: now },
          { id: 3, title: "无日期" },
        ],
      },
    },
    now,
  ).items;
  assert.equal(result[0].id, "notice:stable");
  assert.ok(result[0].aliases.includes("notice:1"));
  assert.equal(result[0].publishedAt, result[1].publishedAt);
  assert.equal(result[2].publishedAt, 0);
  assert.equal(
    learningSelection(initialState(), { items: result }, now).current.length,
    2,
  );
  assert.equal(mergeNotices(result).length, 3, "同文同时间的独立通知必须保留");
});
test("旧版ID删除记录兼容UUID，更新、重启、恢复均一致，助手不泄漏删除内容", () => {
  const directory = dir(),
    w = new Workflows(directory),
    s = initialState();
  const old = {
    id: "notice:7",
    title: "待删除内容",
    summary: "私有合成摘要",
    kind: "notice",
    updatedAt: now,
  };
  w.notices([old.id], [old]);
  const changed = {
    ...old,
    id: "notice:uuid7",
    aliases: ["notice:7", "notice:uuid7"],
    updatedAt: now + 1000,
  };
  const reload = new Workflows(directory);
  s.workflows = reload.data;
  s.learning = { items: [changed] };
  assert.equal(learningSelection(s, s.learning, now).current.length, 0);
  assert.equal(agenda(s, s.learning, now).entries.length, 0);
  assert.equal(assistantContext(s, now).learning.length, 0);
  reload.notices([old.id], [changed], true);
  assert.equal(learningSelection(s, s.learning, now).current.length, 1);
  reload.notices([changed.id], [changed]);
  assert.equal(reload.data.noticeArchive.length, 1);
  assert.equal(learningSelection(s, s.learning, now).current.length, 0);
});
test("作业删除与关联任务联动，重启同步不重建，恢复可逆且专注不变", () => {
  const directory = dir(),
    w = new Workflows(directory),
    store = new Store(directory);
  const item = { ...work, deadline: now + DAY };
  w.importLearning([item], store);
  const logs = JSON.stringify(store.state.logs);
  w.assignments([item.id], [item], store);
  const reload = new Workflows(directory),
    reloadStore = new Store(directory);
  assert.ok(reloadStore.state.tasks[0].deletedAt);
  assert.equal(reload.importLearning([item], reloadStore), 0);
  const state = {
    ...reloadStore.state,
    workflows: reload.data,
    learning: { items: [item] },
  };
  assert.equal(learningSelection(state, state.learning, now).current.length, 0);
  assert.equal(assistantContext(state, now).tasks.length, 0);
  reload.assignments([item.id], [item], reloadStore, true);
  assert.equal(reloadStore.state.tasks[0].deletedAt, null);
  assert.equal(JSON.stringify(reloadStore.state.logs), logs);
});
test("手工删除任务也抑制作业提醒，旧作业不进入推荐或助手任务摘要", () => {
  const directory = dir(),
    w = new Workflows(directory),
    store = new Store(directory);
  w.importLearning([{ ...work, deadline: now - DAY }], store);
  const s = {
    ...store.state,
    workflows: w.data,
    learning: { items: [{ ...work, deadline: now - DAY, yearInferred: true }] },
  };
  assert.equal(agenda(s, s.learning, now).entries.length, 0);
  assert.equal(assistantContext(s, now).tasks.length, 0);
  s.tasks[0].deletedAt = now;
  assert.equal(learningSelection(s, s.learning, now).deleted.length, 1);
});
test("缺少年份的作业仅关注后入库，不自动赋予猜测的DDL", () => {
  const directory = dir(),
    w = new Workflows(directory),
    store = new Store(directory);
  const item = { ...work, deadline: now + DAY, yearInferred: true };
  const learning = { items: [item], courses: [course] };
  assert.equal(
    w.importLearning(
      learningSelection({ ...store.state, workflows: w.data }, learning, now)
        .current,
      store,
    ),
    0,
  );
  w.configure({ courseChoice: { key: course.key, value: "follow" } });
  assert.equal(
    w.importLearning(
      learningSelection({ ...store.state, workflows: w.data }, learning, now)
        .current,
      store,
    ),
    1,
  );
  assert.equal(store.state.tasks[0].due, "");
  assert.equal(store.state.tasks[0].dueTime, "");
});
test("课程配置写入失败回滚，非法课程键不会保存", () => {
  const w = new Workflows(dir());
  assert.throws(() =>
    w.configure({ courseChoice: { key: "bad", value: "follow" } }),
  );
  w.save = () => {
    throw Error("disk failed");
  };
  assert.throws(() =>
    w.configure({ courseChoice: { key: "1:2", value: "hide" } }),
  );
  assert.deepEqual(w.data.courseChoices, {});
});
