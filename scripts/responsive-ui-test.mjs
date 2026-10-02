import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { launchAuthenticated } from "./account-test-fixture.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
const root = path.resolve(import.meta.dirname, "..");
const env = {
  ...process.env,
  VERITAS_TEST: "1",
  VERITAS_TEST_DATA: fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-responsive-"),
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await launchAuthenticated(
  process.argv[2]
    ? { executablePath: path.resolve(process.argv[2]), args: [], env }
    : { args: [root], env },
);
const results = [];
try {
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  const open = async (name) => {
    await page
      .locator(".sidebar button:not(.nav-group-button)")
      .filter({ hasText: name })
      .first()
      .click();
    await page
      .getByRole("heading", {
        name: { 今日概览: "今天的安排", 设置与数据: "设置" }[name] || name,
        exact: true,
      })
      .first()
      .waitFor();
    await page.waitForTimeout(100);
  };
  const measure = async (label) => {
    const value = await page.evaluate(() => {
      const main = document.querySelector("main.page-viewport");
      const s = getComputedStyle(main);
      return {
        label: document.querySelector(".page-heading h1")?.textContent,
        width: main.clientWidth,
        height: main.clientHeight,
        measuredWidth: parseFloat(s.getPropertyValue("--workspace-width")),
        horizontal: document.documentElement.scrollWidth - innerWidth,
        mainHorizontal: main.scrollWidth - main.clientWidth,
        columns: getComputedStyle(
          document.querySelector(".overview-information-grid") || main,
        ).gridTemplateColumns,
        dial: document.querySelector(".timer-dial")?.getBoundingClientRect()
          .width,
      };
    });
    assert.ok(
      value.horizontal <= 1 && value.mainHorizontal <= 1,
      label + " horizontal overflow " + JSON.stringify(value),
    );
    assert.ok(
      value.measuredWidth > 0 && value.measuredWidth <= value.width,
      label + " measurement failed",
    );
    results.push({ test: label, ...value });
    return value;
  };
  for (const size of [
    { width: 1600, height: 900 },
    { width: 1280, height: 720 },
    { width: 1100, height: 720 },
    { width: 960, height: 640 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size);
    for (const title of [
      "今日概览",
      "日程日历",
      "任务清单",
      "四象限",
      "专注空间",
      "时间记录",
      "设置与数据",
      "主题与小组件",
      "校园快讯",
    ]) {
      await open(title);
      await measure(`${size.width}x${size.height}/${title}`);
    }
  }
  const focus = results.filter((x) => x.test.endsWith("/专注空间"));
  assert.ok(
    focus[0].dial > focus.at(-1).dial + 20,
    "timer must resize with available height",
  );
  const home = results.filter((x) => x.test.endsWith("/今日概览"));
  assert.ok(
    home[0].columns.split(" ").length === 4 &&
      home.at(-1).columns.split(" ").length === 2,
    "home must reflow with available width",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await open("今日概览");
  const before = await measure("sidebar expanded");
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  await page.waitForTimeout(100);
  const after = await measure("sidebar collapsed");
  assert.ok(
    after.measuredWidth >= before.measuredWidth,
    "sidebar changes must be measured",
  );
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25),
  );
  await open("日程日历");
  await measure("125% display scaling");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await open("今日概览");
  const iconColors = [];
  for (const theme of THEMES) {
    await page.evaluate(
      (id) => window.veritas.call("workspace.configure", { theme: id }),
      theme.id,
    );
    await page.waitForFunction(
      (id) => document.documentElement.dataset.theme === id,
      theme.id,
    );
    const icon = await page
      .locator(".sidebar .medstack-mark")
      .evaluate((node) => {
        const s = getComputedStyle(node);
        return {
          color: s.color,
          border: s.borderWidth,
          background: s.backgroundColor,
          shadow: s.boxShadow,
        };
      });
    assert.equal(icon.border, "0px");
    assert.equal(icon.background, "rgba(0, 0, 0, 0)");
    assert.equal(icon.shadow, "none");
    iconColors.push(icon.color);
    await measure("theme icon/" + theme.name);
  }
  assert.ok(
    new Set(iconColors).size >= 6,
    "brand icon must follow active theme colors",
  );
  await page.screenshot({
    path: path.join(root, "test-results/responsive-medical.png"),
  });
  await page.screenshot({
    path: path.join(root, "test-results/responsive-small.png"),
  });
  fs.writeFileSync(
    path.join(root, "test-results/responsive-layout.json"),
    JSON.stringify({ passed: true, results }, null, 2),
  );
  console.log(
    `PASS ${results.length} responsive layout checks, dynamic timer size, column reflow, sidebar, 125% scaling`,
  );
} catch (error) {
  await (
    await app.firstWindow()
  ).screenshot({
    path: path.join(root, "test-results/responsive-failure.png"),
  });
  fs.writeFileSync(
    path.join(root, "test-results/responsive-layout.json"),
    JSON.stringify({ passed: false, results, error: error.message }, null, 2),
  );
  throw error;
} finally {
  await app.close();
}
