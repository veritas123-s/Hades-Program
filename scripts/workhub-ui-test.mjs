import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  launchAuthenticated,
  clearSyntheticSession,
} from "./account-test-fixture.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "medstack-workhub-ui-"),
);
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const options = process.argv[2]
  ? { executablePath: path.resolve(process.argv[2]), args: [], env }
  : { args: [root], env };
let app;
const checks = [],
  errors = [];
const ok = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
try {
  app = await launchAuthenticated(options);
  let page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  const call = (action, payload = {}) =>
    page.evaluate(([a, p]) => window.veritas.call(a, p), [action, payload]);
  const nav = async (label) => {
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page
      .getByRole("heading", { name: label, exact: true })
      .first()
      .waitFor();
  };
  await nav("项目管理");
  await page
    .getByRole("button", { name: "新建项目", exact: true })
    .first()
    .click();
  let modal = page.getByRole("dialog");
  await modal.getByLabel("名称", { exact: true }).fill("合成研究项目 Alpha");
  await modal
    .getByLabel("项目目标")
    .fill("明确研究问题，记录真实证据与不确定性。");
  await modal.getByLabel("阶段", { exact: true }).selectOption("active");
  await modal.getByLabel("截止日期", { exact: true }).fill("2026-11-30");
  await modal.getByRole("button", { name: "添加里程碑" }).click();
  await modal.getByLabel("里程碑1", { exact: true }).fill("完成方法评估");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  await page
    .locator(".hub-detail h2")
    .filter({ hasText: "合成研究项目 Alpha" })
    .waitFor();
  ok("通过界面创建项目、阶段、期限与里程碑");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal
    .getByLabel("名称", { exact: true })
    .fill("合成任务：核对原始数据");
  await modal.getByRole("button", { name: "确认", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "完成合成任务：核对原始数据", exact: true })
    .click();
  await page.getByText("100% · 1/1 完成", { exact: true }).waitFor();
  await page.getByRole("button", { name: "添加日程", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel("名称", { exact: true }).fill("合成项目讨论");
  await modal.getByLabel("开始时间").fill("2026-10-05T09:00");
  await modal.getByLabel("结束时间").fill("2026-10-05T10:00");
  await modal.getByRole("button", { name: "确认", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  let s = await call("state");
  assert.equal(s.workhub.projects[0].taskIds[0], s.tasks[0].id);
  assert.equal(s.workhub.projects[0].eventIds[0], s.events[0].id);
  ok("项目任务完成联动与日程共享真实数据");
  await page.getByRole("button", { name: "写记录", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel("名称", { exact: true }).fill("合成文献记录 Alpha");
  await modal.getByLabel("类型", { exact: true }).selectOption("literature");
  await modal.getByRole("button", { name: "插入文献阅读模板" }).click();
  assert.match(
    await modal.getByLabel("正文", { exact: true }).inputValue(),
    /DOI/,
  );
  await modal
    .getByLabel("正文", { exact: true })
    .fill("marker 真实观察与局限。<script>window.bad=true</script>");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /合成文献记录 Alpha/ }).click();
  await page
    .locator(".hub-detail h2")
    .filter({ hasText: "合成文献记录 Alpha" })
    .waitFor();
  assert.equal(await page.evaluate(() => window.bad), undefined);
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel("正文", { exact: true }).fill("修订后的观察与局限");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  await page.getByText("修订历史（保留最近 20 版）", { exact: true }).click();
  await page.getByRole("button", { name: "恢复此版", exact: true }).click();
  await page
    .locator("article.hub-document")
    .filter({ hasText: "marker" })
    .waitFor();
  ok("项目跳转知识记录、文献模板、纯文本显示与历史恢复");
  await nav("项目管理");
  await page.getByLabel("搜索工作台", { exact: true }).fill("marker");
  await page
    .locator(".hub-result")
    .filter({ hasText: "合成文献记录 Alpha" })
    .waitFor();
  await page
    .locator(".hub-result")
    .filter({ hasText: "合成文献记录 Alpha" })
    .click();
  await page
    .locator(".hub-detail h2")
    .filter({ hasText: "合成文献记录 Alpha" })
    .waitFor();
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "全部记录", exact: true }).click();
  assert.equal((await call("state")).workhub.notes[0].deletedAt, null);
  ok("全局跨模块搜索、跳转、知识软删除与恢复");
  const layouts = [];
  for (const size of [
    [1440, 900],
    [1050, 730],
    [800, 600],
  ]) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setMinimumSize(700, 500);
      win.setSize(w, h);
    }, size);
    for (const label of ["工作台", "项目管理", "知识库"]) {
      await nav(label);
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        main:
          document.querySelector("main").scrollWidth -
          document.querySelector("main").clientWidth,
      }));
      assert.ok(
        m.overflow <= 2 && m.main <= 2,
        `${size} ${label}: ${JSON.stringify(m)}`,
      );
      layouts.push({ size, label, ...m });
    }
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1440, 900),
  );
  await nav("工作台");
  for (const theme of THEMES) {
    await call("workspace.configure", { theme: theme.id });
    await page.waitForTimeout(50);
    assert.equal(
      await page.locator("h1").filter({ hasText: "工作台" }).count(),
      1,
    );
  }
  await call("workspace.configure", { theme: "medical" });
  await page.screenshot({
    animations: "disabled",
    path: path.join(output, "workhub-overview.png"),
  });
  await nav("项目管理");
  await page.screenshot({
    animations: "disabled",
    path: path.join(output, "workhub-project.png"),
  });
  ok("3页面3种窗口尺寸无横向溢出，8主题可用");
  s = await call("state");
  const before = s.workhub;
  const backup = path.join(directory, "workhub-export.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await call("export.backup");
  assert.deepEqual(JSON.parse(fs.readFileSync(backup, "utf8")).workhub, before);
  await call("hub.save", {
    collection: "projects",
    title: "备份恢复前临时项目",
    stage: "planning",
  });
  await call("import.backup");
  assert.deepEqual((await call("state")).workhub, before);
  ok("完整备份导出与恢复包含项目、知识修订");
  await clearSyntheticSession(app);
  await app.close();
  app = await launchAuthenticated(options);
  page = await app.firstWindow();
  assert.deepEqual(
    (await page.evaluate(() => window.veritas.call("state"))).workhub,
    before,
  );
  await page.evaluate(() => window.veritas.call("account.logout"));
  const locked = await page.evaluate(() => window.veritas.call("state"));
  assert.ok(locked.locked);
  assert.equal(locked.workhub, undefined);
  await assert.rejects(
    page.evaluate(() =>
      window.veritas.call("hub.save", {
        collection: "projects",
        title: "拒绝",
        stage: "active",
      }),
    ),
    /登录/,
  );
  ok("关闭重启保留全部数据，登出后快照与新命令门禁生效");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "workhub-ui.json"),
    JSON.stringify(
      { checks, layouts, errors, packaged: !!process.argv[2] },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
}
