import test from "node:test";
import assert from "node:assert/strict";
import { initialState, taskInput } from "../src/domain.mjs";
import { overview } from "../src/modules/dashboard/overview.mjs";
import { routeGroup } from "../src/platform/navigation.mjs";
const now = Date.parse("2026-10-02T12:00:00+08:00");
test("首页独立于分类，学习通属于教务信息", () => {
  assert.equal(routeGroup("today"), null);
  assert.equal(routeGroup("assistant"), null);
  assert.equal(routeGroup("learning"), "academic");
});
test("首页仅展示未删除未完成任务和当日课程事件，缺课表保留未知状态", () => {
  const s = initialState();
  s.tasks = [
    taskInput({ title: "当前任务", quadrant: "do", due: "2026-10-02" }),
    { ...taskInput({ title: "已删除", quadrant: "do" }), deletedAt: now },
    { ...taskInput({ title: "已完成", quadrant: "do" }), completedAt: now },
  ];
  s.events = [
    {
      id: "e",
      title: "当前日程",
      start: "2026-10-02T13:00:00+08:00",
      end: "2026-10-02T14:00:00+08:00",
    },
    {
      id: "d",
      title: "删除日程",
      start: "2026-10-02T13:00:00+08:00",
      end: "2026-10-02T14:00:00+08:00",
      deletedAt: now,
    },
  ];
  const v = overview(s, now);
  assert.deepEqual(
    v.tasks.map((t) => t.title),
    ["当前任务"],
  );
  assert.equal(v.deadlines.length, 1);
  assert.deepEqual(
    v.schedule.map((e) => e.title),
    ["当前日程"],
  );
  assert.equal(v.coverage.status, "missing");
});
test("校园卡片排除删除内容及非当日活动", () => {
  const s = initialState();
  s.news = {
    items: [
      {
        id: "a",
        title: "当日活动",
        activityDate: "2026-10-02",
        publishedAt: now,
      },
      {
        id: "b",
        title: "删除活动",
        activityDate: "2026-10-02",
        deletedAt: now,
      },
      { id: "c", title: "其他日期", activityDate: "2026-10-03" },
    ],
  };
  assert.deepEqual(
    overview(s, now).notices.map((x) => x.title),
    ["当日活动"],
  );
});
test("旧学习通作业关联任务不进入首页，刷新不复活已删除通知", () => {
  const s = initialState();
  s.tasks = [
    { ...taskInput({ title: "旧课程任务", quadrant: "do" }), id: "linked-old" },
  ];
  s.learning = {
    items: [
      {
        id: "old",
        taskId: "linked-old",
        kind: "assignment",
        title: "旧作业",
        courseKey: "old-course",
        deadline: now - 200 * 86400000,
      },
      {
        id: "notice:deleted",
        kind: "notice",
        title: "已删通知",
        publishedAt: now,
        deletedAt: now,
      },
    ],
  };
  s.workflows = {
    noticeArchive: [{ item: s.learning.items[1], deletedAt: now }],
  };
  const v = overview(s, now);
  assert.equal(v.tasks.length, 0);
  assert.ok(!v.notices.some((x) => x.title === "已删通知"));
});

test("首页校园快讯合并学习通通知和最近公开资讯，删除仍隐藏", () => {
  const s = initialState();
  s.learning = {
    items: [
      {
        id: "notice:current",
        kind: "notice",
        title: "学习通消息",
        publishedAt: now,
      },
    ],
  };
  s.news = {
    items: [
      {
        id: "public",
        title: "公开资讯",
        source: "公开网站",
        publishedAt: now - 1000,
      },
      { id: "old-public", title: "旧资讯", publishedAt: now - 2 * 86400000 },
      {
        id: "deleted-public",
        title: "已删公开资讯",
        publishedAt: now,
        deletedAt: now,
      },
    ],
  };
  assert.deepEqual(
    new Set(overview(s, now).notices.map((x) => x.title)),
    new Set(["学习通消息", "公开资讯"]),
  );
});

test("首页公开快讯合并同标题多来源", () => {
  const s = initialState();
  s.news = {
    items: [
      {
        id: "one",
        title: "校园医学科研交流讲座合成通知",
        source: "组织甲",
        publishedAt: now - 1000,
      },
      {
        id: "two",
        title: "校园医学科研交流讲座合成通知",
        source: "组织乙",
        publishedAt: now - 2000,
      },
    ],
  };
  const rows = overview(s, now).notices;
  assert.equal(rows.length, 1);
  assert.match(rows[0].subtitle, /2 个来源/);
});
