import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initialState, validateState, taskInput } from "../src/domain.mjs";
import { Store } from "../electron/store.mjs";
import content from "../electron/commands/content.mjs";
import tasks from "../electron/commands/tasks.mjs";
import * as domain from "../src/domain.mjs";
import {
  courseKey,
  visibleCourses,
  eventInput,
} from "../src/domain/content.mjs";
import { calendarEvents, eventsOnDay } from "../src/calendar.mjs";
import { buildFeed } from "../src/briefing.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
import { appearanceInput, defaultAppearance } from "../src/themes/custom.mjs";
import { updateWorkspace } from "../src/platform/model.mjs";
import { ThemeAssets } from "../electron/theme-assets.mjs";
const make = () =>
  new Store(fs.mkdtempSync(path.join(os.tmpdir(), "medstack22-unit-")));
test("V2.1 原始数据升级不丢失任务和专注记录，迁移保存原文件", () => {
  const s = initialState();
  s.schemaVersion = 3;
  delete s.lists;
  delete s.events;
  delete s.courseTrash;
  s.tasks = [taskInput({ title: "复习", project: "科研", quadrant: "plan" })];
  s.logs = [
    {
      id: "saved-focus",
      title: "已保存专注",
      mode: "focus",
      completed: true,
      segments: [{ start: 1790000000000, end: 1790001500000 }],
      durationMs: 1500000,
    },
  ];
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "medstack22-migrate-")),
    raw = JSON.stringify(s);
  fs.writeFileSync(path.join(d, "veritas-data.json"), raw);
  const store = new Store(d);
  assert.equal(store.state.schemaVersion, 5);
  assert.equal(store.state.logs[0].durationMs, 1500000);
  assert.deepEqual(store.state.logs[0].segments, s.logs[0].segments);
  assert.deepEqual(store.state.tasks, validateState(s).tasks);
  assert.equal(
    store.state.lists.find((x) => x.name === "科研").deletedAt,
    null,
  );
  assert.equal(
    fs.readFileSync(
      path.join(
        d,
        fs.readdirSync(d).find((x) => x.startsWith("veritas-data.pre-schema3")),
      ),
      "utf8",
    ),
    raw,
  );
});

test("背景资产拒绝越界、伪装文件与篡改备份，缺图时不执行恢复", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack22-assets-"));
  const assets = new ThemeAssets(directory, {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 10, height: 10 }),
      toPNG: () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
    }),
  });
  assert.throws(() => assets.read("../veritas-data.json"));
  assert.throws(() => assets.encode(Buffer.from('<svg onload="evil()"/>')));
  const bytes = assets.encode(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
    ),
    id = assets.store(bytes),
    s = initialState();
  s.workspace.appearance.image = id;
  const exported = assets.export(s);
  assert.throws(() =>
    assets.prepareRestore(
      { themeAssets: { [id]: Buffer.from("tampered").toString("base64") } },
      s,
    ),
  );
  const fresh = new ThemeAssets(
    fs.mkdtempSync(path.join(os.tmpdir(), "medstack22-assets-fresh-")),
    assets.nativeImage,
  );
  assert.throws(() => fresh.prepareRestore({}, s));
  assert.equal(fs.existsSync(fresh.directory), false);
  const restore = fresh.prepareRestore({ themeAssets: exported }, s);
  assert.equal(fs.existsSync(fresh.directory), false);
  restore();
  assert.deepEqual(fresh.read(id), bytes);
});
test("清单独立创建、重命名、删除转移、级联删除和恢复保留专注记录", async () => {
  const store = make(),
    ctx = { store, domain, getWindow: () => null };
  await tasks(
    "task.save",
    { title: "学习", project: "科研", quadrant: "plan" },
    ctx,
  );
  const id = store.state.lists.find((x) => x.name === "科研").id;
  await content("list.save", { id, name: "医学" }, ctx);
  assert.equal(store.state.tasks[0].project, "医学");
  const logs = structuredClone(store.state.logs);
  await content("list.delete", { id }, ctx);
  assert.equal(store.state.tasks[0].project, "收集箱");
  assert.ok(store.state.lists.find((x) => x.id === id).deletedAt);
  await content("list.restore", { id }, ctx);
  assert.equal(store.state.lists.find((x) => x.id === id).deletedAt, null);
  await tasks("task.save", { ...store.state.tasks[0], project: "医学" }, ctx);
  await content("list.delete", { id, withTasks: true }, ctx);
  assert.ok(store.state.tasks[0].deletedAt);
  await tasks("task.restore", { id: store.state.tasks[0].id }, ctx);
  assert.equal(store.state.lists.find((x) => x.id === id).deletedAt, null);
  assert.deepEqual(store.state.logs, logs);
  assert.doesNotThrow(() => validateState(store.state));
});
test("删除课程在重复同步后仍隐藏，日历和快报一致，恢复不重复", async () => {
  const store = make(),
    c = {
      title: "合成课程",
      start: "2026-09-28T08:00:00",
      end: "2026-09-28T09:00:00",
      ids: { CSID: "1" },
    };
  store.change((s) => {
    s.courses = [c];
  });
  const key = courseKey(c);
  await content("course.delete", { key }, { store });
  store.change((s) => {
    s.courses = [{ ...c, location: "重新同步后的教室" }];
  });
  assert.equal(visibleCourses(store.state).length, 0);
  assert.equal(calendarEvents(store.state).length, 0);
  assert.equal(
    buildFeed(store.state).timetable.courses["2026-09-28"],
    undefined,
  );
  await content("course.restore", { key }, { store });
  assert.equal(visibleCourses(store.state).length, 1);
  const restarted = new Store(path.dirname(store.file));
  assert.equal(restarted.state.courses.length, 1);
});
test("跨日日程覆盖结束前一天，软删除恢复，非法日期事务不落盘", async () => {
  const store = make(),
    p = {
      title: "跨日活动",
      start: "2028-02-28T23:00",
      end: "2028-03-01T00:00",
    };
  await content("event.save", p, { store });
  const id = store.state.events[0].id;
  assert.equal(
    eventsOnDay(calendarEvents(store.state), "2028-02-29").length,
    1,
  );
  assert.equal(
    eventsOnDay(calendarEvents(store.state), "2028-03-01").length,
    0,
  );
  await content("event.delete", { id }, { store });
  assert.equal(calendarEvents(store.state).length, 0);
  await content("event.restore", { id }, { store });
  assert.equal(calendarEvents(store.state).length, 1);
  const before = fs.readFileSync(store.file, "utf8");
  await assert.rejects(
    content("event.save", { ...p, end: "2027-02-29T10:00" }, { store }),
  );
  assert.equal(fs.readFileSync(store.file, "utf8"), before);
  assert.throws(() => eventInput({ ...p, end: p.start }));
});
test("七种主题、受限背景字段、自定义主题与完整状态往返", () => {
  assert.equal(THEMES.length, 7);
  assert.ok(
    ["violet", "orbital", "millennium"].every((id) =>
      THEMES.some((t) => t.id === id),
    ),
  );
  for (const image of [
    "../../secret",
    "https://remote/image.png",
    "file:///private",
  ])
    assert.throws(() => appearanceInput({ image }));
  assert.throws(() => appearanceInput({ opacity: 61 }));
  const s = initialState(),
    theme = {
      id: "custom-test1",
      name: "测试",
      base: "violet",
      colors: {
        accent: "#334455",
        background: "#eeeeee",
        surface: "#ffffff",
        text: "#121212",
      },
      appearance: defaultAppearance(),
    };
  s.workspace = updateWorkspace(s.workspace, {
    customThemes: [theme],
    theme: theme.id,
  });
  assert.deepEqual(validateState(s).workspace, s.workspace);
  assert.throws(() =>
    updateWorkspace(s.workspace, { customThemes: [theme, theme] }),
  );
  assert.throws(() =>
    updateWorkspace(s.workspace, {
      customThemes: [
        { ...theme, colors: { ...theme.colors, text: "red;url(x)" } },
      ],
    }),
  );
});
