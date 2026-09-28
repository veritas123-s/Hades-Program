import { launchAuthenticated } from "./account-test-fixture.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { initialState, taskInput } from "../src/domain.mjs";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hades-v21-ui-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const seed = initialState();
seed.workspace.theme = "paper";
seed.tasks = [
  taskInput({
    title: "统计学复习",
    project: "学习",
    quadrant: "plan",
    due: "2028-02-29",
    dueTime: "18:00",
  }),
  taskInput({ title: "已完成实验报告", quadrant: "plan", due: "2028-02-29" }),
  taskInput({ title: "待安排阅读", quadrant: "plan" }),
];
seed.tasks[1].completedAt = Date.now();
seed.courses = [
  {
    title: "组织学课程",
    start: "2028-02-29T08:00:00",
    end: "2028-02-29T09:40:00",
    location: "合成教室",
    teacher: "合成教师",
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    title: i % 2 ? "生物化学" : "临床导论",
    start: `2028-02-${String(i * 3 + 1).padStart(2, "0")}T10:00:00`,
    end: `2028-02-${String(i * 3 + 1).padStart(2, "0")}T11:40:00`,
  })),
];
seed.courseRanges = [
  { start: "2028-02-01", end: "2028-03-01", syncedAt: Date.now() },
];
fs.writeFileSync(
  path.join(directory, "veritas-data.json"),
  JSON.stringify(seed),
);
const items = [1, 2, 3].map((i) => ({
  id: `notice:synthetic-${i}`,
  kind: "notice",
  title: `合成通知${i}`,
  summary: "仅用于本机验证的通知摘要。",
  updatedAt: Date.now() + i,
}));
fs.writeFileSync(
  path.join(directory, "learning-cache.json"),
  JSON.stringify({
    version: 1,
    items,
    lastSuccess: Date.now(),
    courseCount: 0,
    coveredCourses: 0,
  }),
);
let app;
const checks = [];
const errors = [];
const launch = () =>
  launchAuthenticated(
    process.argv[2]
      ? { executablePath: path.resolve(process.argv[2]), args: [], env }
      : { args: [process.cwd()], env },
  );
const pass = (x) => {
  checks.push(x);
  console.log("PASS " + x);
};
try {
  app = await launch();
  let page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  const call = (a, p = {}) =>
    page.evaluate(([a, p]) => window.veritas.call(a, p), [a, p]);
  await page.getByRole("button", { name: "打开通知中心" }).click();
  await page.getByRole("button", { name: "超星通知", exact: true }).click();
  await page
    .getByRole("button", { name: "删除通知 合成通知1", exact: true })
    .click();
  await page.getByRole("button", { name: "已删除 1", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "合成通知1", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "本页标为已读", exact: true }).click();
  await page
    .getByRole("button", { name: "清理已读超星通知（2）", exact: true })
    .click();
  await page.getByRole("button", { name: "已删除 3", exact: true }).click();
  await page
    .getByRole("button", { name: "恢复通知 合成通知1", exact: true })
    .click();
  await page.getByRole("button", { name: "已删除 2", exact: true }).waitFor();
  assert.equal((await call("state")).tasks.length, 3);
  pass("单条删除、清理已读、恢复，任务不受影响");
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "打开通知中心" }).click();
  await page.getByRole("button", { name: "超星通知", exact: true }).click();
  await page.getByRole("heading", { name: "合成通知1", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "合成通知2", exact: true }).count(),
    0,
  );
  await page.getByLabel("选择本页超星通知", { exact: true }).check();
  await page
    .getByRole("button", { name: "删除所选（1）", exact: true })
    .click();
  await page.getByRole("button", { name: "已删除 3", exact: true }).waitFor();
  pass("删除状态重启保留，批量选择删除");
  if (await page.getByRole("button", { name: "关闭提示", exact: true }).count())
    await page.getByRole("button", { name: "关闭提示", exact: true }).click();
  await page.getByRole("button", { name: "日程日历", exact: true }).click();
  await page.getByRole("heading", { name: "日程日历", exact: true }).waitFor();
  await page.getByLabel("跳转日期").fill("2028-02-29");
  await page
    .getByRole("heading", { name: "组织学课程", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "统计学复习", exact: true })
    .waitFor();
  assert.equal(await page.locator(".calendar-month-grid > button").count(), 42);
  await page.getByLabel("包含已完成任务").uncheck();
  assert.equal(
    await page
      .getByRole("heading", { name: "已完成实验报告", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("包含已完成任务").check();
  await page.screenshot({
    path: "test-results/v2.1-month.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "下一期", exact: true }).click();
  assert.equal(await page.getByLabel("跳转日期").inputValue(), "2028-03-29");
  await page.getByRole("button", { name: "上一期", exact: true }).click();
  await page.getByRole("button", { name: "年", exact: true }).click();
  assert.equal(await page.locator(".calendar-mini-month").count(), 12);
  await page.screenshot({
    path: "test-results/v2.1-year.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", {
      name: "2028-02-29，2 项任务，1 节课程",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "日", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("heading", { name: "组织学课程", exact: true })
    .waitFor();
  pass("年/月/日、闰日、月份导航、课程与任务、已完成过滤");
  await page.getByLabel("跳转日期").fill("2028-03-15");
  await page
    .getByText("本日课表未同步，不能据此判断无课", { exact: false })
    .waitFor();
  await page.getByLabel("跳转日期").fill("2028-02-29");
  await page
    .locator(".calendar-event")
    .filter({ hasText: "统计学复习" })
    .getByRole("button", { name: "查看任务" })
    .click();
  await page.getByRole("dialog").waitFor();
  const motion = await page
    .locator(".modal")
    .evaluate((e) => getComputedStyle(e).animationName);
  assert.equal(motion, "hades-popup");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator(".calendar-event")
    .filter({ hasText: "统计学复习" })
    .getByRole("button", { name: "查看任务" })
    .click();
  assert.equal(
    await page
      .locator(".modal")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  pass("未知课表明确标注、任务详情弹窗动画、减少动态效果");
  for (const theme of ["paper", "monument", "midnight"]) {
    await call("workspace.configure", { theme });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1100, 820),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Horizontal overflow",
    );
    await page.screenshot({
      path: `test-results/v2.1-day-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  assert.deepEqual(errors, []);
  pass("三主题、1100px布局与渲染无错误");
  fs.writeFileSync(
    "test-results/v2.1-ui.json",
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
} finally {
  if (app) await app.close();
}
