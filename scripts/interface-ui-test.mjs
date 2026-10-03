import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { initialState, taskInput } from "../src/domain.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
import { beijingDay } from "../src/briefing.mjs";

const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-interface-"));
const profile = fixtureProfile(directory);
const output = path.join(root, "test-results", "interface");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(output, { recursive: true });
const state = initialState();
state.workspace.theme = "paper";
state.workspace.onboardingVersion = 1;
state.tasks = Array.from({ length: 24 }, (_, i) =>
  taskInput({
    title:
      ["整理课程笔记", "复习免疫学章节", "准备文献讨论", "整理实验记录"][
        i % 4
      ] + ` · 示例 ${i + 1}`,
    quadrant: ["do", "plan", "delegate", "later"][i % 4],
    project: "学习",
    due: beijingDay(),
  }),
);
fs.writeFileSync(
  path.join(directory, "veritas-data.json"),
  JSON.stringify(state),
);
fs.writeFileSync(
  path.join(profile, "campus-news.json"),
  JSON.stringify({
    version: 1,
    automatic: false,
    coverage: [],
    items: [
      {
        id: "design-one",
        title: "医学与人文：一场关于临床观察的讨论（示例）",
        excerpt:
          "从日常学习出发，讨论观察、记录与表达之间的联系。本条为界面验证示例。",
        source: "示例学术平台",
        publishedAt: Date.now() - 60000,
        date: beijingDay(),
        url: "https://news.sjtu.edu.cn/synthetic-design-one",
      },
      {
        id: "design-two",
        title: "图书馆秋季开放安排（示例）",
        excerpt: "本条为合成通知，用于检查多行标题、来源和阅读节奏。",
        source: "示例校园平台",
        publishedAt: Date.now() - 120000,
        date: beijingDay(),
        url: "https://news.sjtu.edu.cn/synthetic-design-two",
      },
    ],
  }),
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const app = await launchAuthenticated({
  ...(process.argv[2]
    ? { executablePath: path.resolve(process.argv[2]), args: [] }
    : { args: [root] }),
  env,
});
const results = [];
try {
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "主导航" });
  async function open(label) {
    await nav
      .getByRole("button", {
        name: label === "任务清单" ? /^任务清单/ : label,
        exact: true,
      })
      .click();
    await page.waitForTimeout(80);
  }
  const overview = nav.getByRole("button", { name: "今日概览", exact: true });
  const news = nav.getByRole("button", { name: "校园快讯", exact: true });
  await open("校园快讯");
  assert.equal(await news.getAttribute("aria-current"), "page");
  assert.equal(await overview.getAttribute("aria-current"), null);
  const rows = await nav.locator(".nav-item").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const text = node.querySelector("span").getBoundingClientRect();
      return {
        label: node.textContent,
        height: rect.height,
        radius: style.borderRadius,
        textX: text.x,
      };
    }),
  );
  assert.ok(
    rows.every(
      (row) =>
        row.height === rows[0].height &&
        row.radius === rows[0].radius &&
        Math.abs(row.textX - rows[0].textX) < 1,
    ),
  );
  results.push({ check: "Consistent navigation row geometry", rows });

  // Keyboard activation must still navigate; a folded category must locate the current page.
  await news.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "校园快讯", exact: true }).waitFor();
  await open("任务清单");
  const efficiency = nav.getByRole("button", {
    name: "效率工具板块",
    exact: true,
  });
  await efficiency.click();
  assert.equal(await efficiency.getAttribute("aria-expanded"), "false");
  assert.match(await efficiency.getAttribute("class"), /active/);
  assert.equal(
    await nav.getByRole("button", { name: "任务清单", exact: true }).count(),
    0,
  );
  await efficiency.click();
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  await open("校园快讯");
  assert.equal(await news.getAttribute("aria-current"), "page");
  await efficiency.click();
  await page
    .getByRole("region", { name: "效率工具菜单" })
    .getByRole("button", { name: "任务清单", exact: true })
    .click();
  await page.getByRole("heading", { name: "任务清单", exact: true }).waitFor();
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  results.push({
    check: "Keyboard activation, folded selection and collapsed group popup",
  });

  // Workspace preferences still control visibility; no personal data enters the fixture.
  await page.evaluate(() =>
    window.veritas.call("workspace.configure", {
      navigation: { collapsed: false, hidden: ["campus-news"] },
    }),
  );
  await news.waitFor({ state: "detached" });
  await page.evaluate(() =>
    window.veritas.call("workspace.configure", {
      navigation: { collapsed: false, hidden: [] },
    }),
  );
  await news.waitFor();
  for (const theme of THEMES) {
    await page.evaluate(
      (id) => window.veritas.call("workspace.configure", { theme: id }),
      theme.id,
    );
    await page.waitForFunction(
      (id) => document.documentElement.dataset.theme === id,
      theme.id,
    );
    for (const [width, height] of [
      [1366, 768],
      [1000, 720],
      [800, 600],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, size) =>
          BrowserWindow.getAllWindows()[0].setContentSize(...size),
        [width, height],
      );
      for (const label of ["今日概览", "校园快讯"]) {
        await open(label);
        const layout = await page
          .locator(".page-viewport")
          .evaluate((node) => ({
            width: node.clientWidth,
            scrollWidth: node.scrollWidth,
            height: node.clientHeight,
            scrollHeight: node.scrollHeight,
          }));
        assert.ok(
          layout.scrollWidth <= layout.width + 2,
          `${theme.id}/${width}/${label}: horizontal overflow`,
        );
        assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
        if (label === "今日概览" && width === 1366)
          assert.ok(
            layout.scrollHeight <= layout.height + 2,
            "Desktop overview must fit",
          );
        results.push({ theme: theme.id, width, page: label, ...layout });
        if (width === 1366)
          await page.screenshot({
            scale: "css",
            animations: "disabled",
            path: path.join(
              output,
              `${theme.id}-${label === "今日概览" ? "overview" : "news"}.png`,
            ),
          });
      }
    }
  }
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify({ passed: true, checks: results.length, results }, null, 2),
  );
  console.log(
    `PASS ${results.length} interface checks: navigation, keyboard, visibility, eight themes and three window sizes`,
  );
} catch (error) {
  await (
    await app.firstWindow()
  ).screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  await app.close();
}
