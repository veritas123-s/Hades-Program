import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { initialState, taskInput } from "../src/domain.mjs";
import { beijingDay } from "../src/briefing.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hades22-ui-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: dir };
delete env.ELECTRON_RUN_AS_NODE;
const seed = initialState(),
  today = beijingDay();
seed.workspace.theme = "paper";
seed.tasks = [
  taskInput({
    title: "准备课程报告",
    project: "学习计划",
    quadrant: "plan",
    due: today,
  }),
];
seed.courses = [
  {
    title: "合成人体构造课",
    start: today + "T08:00:00",
    end: today + "T09:30:00",
    location: "模拟教室",
  },
];
seed.workspace.widgets.order.push("quick-note");
fs.writeFileSync(path.join(dir, "veritas-data.json"), JSON.stringify(seed));
let app, page;
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const call = (a, p = {}) =>
  page.evaluate(([a, p]) => window.veritas.call(a, p), [a, p]);
const go = (name) => page.getByRole("button", { name, exact: true }).click();
const close = () =>
  page.getByRole("button", { name: "关闭", exact: true }).click();
const launch = async () => {
  app = await electron.launch(
    process.argv[2]
      ? { executablePath: path.resolve(process.argv[2]), args: [], env }
      : { args: [process.cwd()], env },
  );
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1440, 1000),
  );
};
try {
  await launch();
  assert.equal(await page.locator('[data-calendar="unified"]').count(), 1);
  assert.equal(
    await page
      .locator('[data-widget="priority"],[data-widget="courses"],.agenda-hero')
      .count(),
    0,
  );
  await page
    .getByRole("heading", { name: "合成人体构造课", exact: true })
    .waitFor();
  await go("新建日程");
  await page.getByLabel("日程标题", { exact: true }).fill("小组讨论");
  await go("保存日程");
  await page.getByRole("heading", { name: "小组讨论", exact: true }).waitFor();
  await go("编辑日程 小组讨论");
  await page.getByLabel("日程标题", { exact: true }).fill("实验讨论");
  await go("保存日程");
  await go("删除日程 实验讨论");
  await go("日程回收站");
  await go("恢复日程");
  await close();
  await page.getByRole("heading", { name: "实验讨论", exact: true }).waitFor();
  await go("删除课程 合成人体构造课");
  await go("日程回收站");
  await go("恢复课程");
  await close();
  assert.equal((await call("state")).courses.length, 1);
  await go("校园与课表");
  await page.locator('[data-calendar="unified"]').waitFor();
  assert.equal(await page.locator('[data-calendar="unified"]').count(), 1);
  assert.equal(await page.locator(".week-grid").count(), 0);
  await go("年");
  assert.equal(await page.locator(".calendar-mini-month").count(), 12);
  assert.ok(
    (await page.locator(".mini .calendar-day").first().boundingBox()).height <
      45,
  );
  await go("日");
  await go("月");
  pass("首页与校园共用日历，手动日程新增/编辑/删除/恢复，课程删除/恢复");
  await go("今日概览");
  await go("查看任务");
  await go("删除任务");
  assert.ok((await call("state")).tasks[0].deletedAt);
  await call("task.restore", { id: seed.tasks[0].id });
  await go("新建清单");
  await page.getByLabel("清单名称").fill("独立空清单");
  await go("创建清单");
  await go("删除清单 学习计划");
  await go("确认删除");
  assert.equal((await call("state")).tasks[0].project, "收集箱");
  await page.locator("summary").filter({ hasText: "已删除的清单" }).click();
  await go("恢复清单");
  await close();
  pass("任务编辑器可删除，独立清单创建与删除恢复，默认保留任务");
  await page.getByLabel("随手记内容").fill("需要保留的想法");
  await go("保存便笺");
  await page.getByRole("button", { name: "已保存", exact: true }).waitFor();
  await go("删除便笺");
  assert.equal(await page.getByLabel("随手记内容").inputValue(), "");
  await go("恢复便笺");
  assert.equal(
    await page.getByLabel("随手记内容").inputValue(),
    "需要保留的想法",
  );
  pass("便笺删除可撤回");
  for (const t of THEMES) {
    await go("更换主题");
    await page.locator(".theme-choice").first().waitFor();
    assert.equal(await page.locator(".theme-choice").count(), 7);
    await go(`使用${t.name}主题`);
    await page.waitForFunction(
      (id) => document.documentElement.dataset.theme === id,
      t.id,
    );
    await go("今日概览");
    await page.locator('[data-calendar="unified"]').waitFor();
    await page.screenshot({
      path: `test-results/v22-${t.id}-home.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  pass("七套主题切换与首页截图，无横向溢出");
  await go("更换主题");
  await go("使用紫雾花园主题");
  const image = path.join(dir, "synthetic-background.png");
  const generated = await app.evaluate(({ nativeImage, dialog }, file) => {
    const bytes = Buffer.alloc(80 * 60 * 4, 180);
    for (let i = 3; i < bytes.length; i += 4) bytes[i] = 255;
    const img = nativeImage.createFromBitmap(bytes, { width: 80, height: 60 });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    return img.toPNG().toString("base64");
  }, image);
  fs.writeFileSync(image, Buffer.from(generated, "base64"));
  await go("选择背景图");
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--theme-art")
      .includes("user-backgrounds"),
  );
  const snapshot = await call("state"),
    imageId = snapshot.workspace.appearance.image;
  assert.match(imageId, /^[a-f0-9]{64}\.png$/);
  const loaded = await page.evaluate(async (id) => {
    const img = new Image();
    img.src = "veritas://app/user-backgrounds/" + id;
    await img.decode();
    return img.naturalWidth;
  }, imageId);
  assert.equal(loaded, 80);
  await page.getByLabel("自定义主题名称").fill("我的紫色");
  await go("保存为我的主题");
  await page
    .getByRole("button", { name: "使用我的紫色", exact: true })
    .waitFor();
  await go("删除主题 我的紫色");
  await page.locator("summary").filter({ hasText: "已删除的主题" }).click();
  await go("恢复主题");
  await go("使用我的紫色");
  await go("移除背景图");
  await page.waitForFunction(
    () => document.documentElement.dataset.wallpaper === "no",
  );
  await go("使用我的紫色");
  const saved = (await call("state")).workspace;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 820),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/v22-custom-1100.png",
    fullPage: true,
    animations: "disabled",
  });
  pass("自选背景实际解码显示、自定义主题保存删除恢复、1100px 设置布局");
  const backup = path.join(dir, "complete-backup.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, backup);
  await call("export.backup");
  const exported = JSON.parse(fs.readFileSync(backup, "utf8"));
  assert.ok(exported.themeAssets[imageId]);
  await app.close();
  app = null;
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "hades22-restore-"));
  env.VERITAS_TEST_DATA = fresh;
  await launch();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await call("import.backup");
  assert.deepEqual((await call("state")).workspace, saved);
  assert.ok(fs.existsSync(path.join(fresh, "theme-backgrounds", imageId)));
  await app.close();
  app = null;
  await launch();
  assert.deepEqual((await call("state")).workspace, saved);
  assert.equal((await call("state")).events[0].title, "实验讨论");
  assert.equal(
    await page.getByLabel("随手记内容").inputValue(),
    "需要保留的想法",
  );
  pass("全新数据目录导入完整备份恢复背景与业务数据，退出重启保持一致");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/v2.2-results.json",
    JSON.stringify(
      { passed: true, packaged: !!process.argv[2], checks, errors },
      null,
      2,
    ),
  );
} catch (e) {
  fs.writeFileSync(
    "test-results/v2.2-results.json",
    JSON.stringify(
      { passed: false, checks, error: e.message, errors },
      null,
      2,
    ),
  );
  if (page)
    await page
      .screenshot({ path: "test-results/v22-failure.png", fullPage: true })
      .catch(() => {});
  throw e;
} finally {
  if (app) await app.close();
}
