import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { initialState, taskInput, validateState } from "../src/domain.mjs";
import { beijingDay } from "../src/briefing.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack52-")),
  profile = fixtureProfile(directory);
fs.mkdirSync(profile, { recursive: true });
const s = initialState(),
  today = beijingDay();
s.tasks = Array.from({ length: 32 }, (_, i) =>
  taskInput({
    title: "合成学习任务 " + (i + 1),
    quadrant: ["do", "plan", "delegate", "later"][i % 4],
    project: "学习",
    due: today,
  }),
);
s.events = [
  {
    id: "synthetic-event",
    title: "合成学术讨论",
    start: today + "T15:00",
    end: today + "T16:00",
    allDay: false,
    location: "合成地点",
    createdAt: Date.now(),
    deletedAt: null,
  },
];
validateState(s);
fs.writeFileSync(path.join(directory, "veritas-data.json"), JSON.stringify(s));
fs.writeFileSync(
  path.join(profile, "learning-cache.json"),
  JSON.stringify({
    version: 1,
    items: [
      {
        id: "notice:synthetic",
        kind: "notice",
        title: "合成超星通知",
        publishedAt: Date.now(),
        summary: "离线验证",
      },
    ],
    courses: [],
    lastSuccess: Date.now(),
  }),
);
fs.writeFileSync(
  path.join(profile, "campus-news.json"),
  JSON.stringify({
    version: 1,
    automatic: false,
    items: [
      {
        id: "synthetic-public",
        title: "合成公开平台快讯",
        source: "合成新闻网",
        publishedAt: Date.now() - 120000,
        date: today,
        url: "https://news.sjtu.edu.cn/synthetic",
      },
    ],
    coverage: [],
  }),
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
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
  assert.equal(await page.locator(".sidebar nav > .overview-nav").count(), 1);
  assert.equal(
    await page
      .locator(".sidebar nav button")
      .filter({ hasText: "Poseidon" })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: "日程与通知", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator(".overview-learning").count(), 0);
  assert.equal(
    await page
      .locator(".overview-notices")
      .getByRole("heading", { name: "校园快讯", exact: true })
      .count(),
    1,
  );
  assert.ok(
    await page
      .locator(".overview-notices")
      .getByText("合成超星通知", { exact: true })
      .isVisible(),
  );
  assert.ok(
    await page
      .locator(".overview-notices")
      .getByText("合成公开平台快讯", { exact: true })
      .isVisible(),
  );
  assert.equal(
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: "快报与提醒", exact: true })
      .count(),
    0,
  );
  const open = async (title, heading = title) => {
    await page
      .locator(".sidebar button:not(.nav-group-button)")
      .filter({ hasText: title })
      .first()
      .click();
    await page
      .getByRole("heading", { name: heading, exact: true })
      .first()
      .waitFor();
    await page.waitForTimeout(100);
  };
  async function measure(label, oneScreen = false) {
    const v = await page.evaluate(() => {
      const m = document.querySelector("main.page-viewport");
      const h = m.querySelector("h1");
      return {
        body: document.documentElement.scrollHeight - innerHeight,
        horizontal: document.documentElement.scrollWidth - innerWidth,
        mainHorizontal: m.scrollWidth - m.clientWidth,
        main: m.scrollHeight - m.clientHeight,
        font: parseFloat(getComputedStyle(h).fontSize),
        bodyFont: parseFloat(getComputedStyle(m).fontSize),
        summaryFont: parseFloat(
          getComputedStyle(m.querySelector(".overview-metric") || h).fontSize,
        ),
      };
    });
    assert.ok(
      v.body <= 1 && v.horizontal <= 1 && v.mainHorizontal <= 1,
      label + JSON.stringify(v),
    );
    if (oneScreen) assert.ok(v.main <= 1, label + " page scroll " + v.main);
    results.push({ label, ...v });
  }
  for (const size of [
    { width: 1600, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1100, height: 720 },
    { width: 960, height: 640 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size);
    for (const [route, h] of [
      ["今日概览", "今天的安排"],
      ["日程日历", "日程日历"],
      ["任务清单", "任务清单"],
      ["四象限", "四象限"],
      ["专注空间", "专注空间"],
      ["超星学习通", "超星学习通"],
      ["校园快讯", "校园快讯"],
      ["校园与课表", "校园与课表"],
      ["设置与数据", "设置"],
      ["主题与小组件", "主题与小组件"],
    ]) {
      await open(route, h);
      await measure(
        size.width + "/" + route,
        route === "今日概览" && size.width >= 1280,
      );
      assert.ok(
        await page
          .getByRole("button", { name: "打开 AI 助手", exact: true })
          .isVisible(),
      );
      await page
        .getByRole("button", { name: "打开 AI 助手", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Poseidon 嵌入式助手" }).waitFor();
      await page
        .getByRole("button", { name: "关闭 AI 助手", exact: true })
        .click();
    }
  }
  const homes = results.filter((x) => x.label.endsWith("/今日概览"));
  assert.ok(homes[0].font > homes.at(-1).font + 3, "heading must scale");
  assert.ok(
    homes[0].bodyFont > homes.at(-1).bodyFont + 2,
    "body text must scale",
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await open("超星学习通");
  await page.getByRole("button", { name: "连接与课程", exact: true }).click();
  await page
    .getByRole("button", { name: "学习通扫码登录", exact: true })
    .waitFor();
  await open("设置与数据", "设置");
  await page
    .getByRole("button", { name: "展开自动工作流", exact: true })
    .click();
  assert.ok(
    await page
      .getByRole("checkbox", {
        name: "学习通未交作业自动加入任务清单",
        exact: true,
      })
      .isVisible(),
  );
  await open("校园快讯");
  assert.equal(
    await page.getByRole("button", { name: "学习通连接", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "今日概览", exact: true })
      .isVisible(),
  );
  assert.equal(await page.locator(".sidebar .nav-group-button").count(), 3);
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page.getByRole("dialog", { name: "Poseidon 嵌入式助手" }).waitFor();
  await page.getByRole("button", { name: "关闭 AI 助手", exact: true }).click();
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  for (const theme of THEMES) {
    await page.evaluate(
      (id) => window.veritas.call("workspace.configure", { theme: id }),
      theme.id,
    );
    await page.waitForFunction(
      (id) => document.documentElement.dataset.theme === id,
      theme.id,
    );
    await open("今日概览", "今天的安排");
    await measure("theme/" + theme.id, true);
    await page.screenshot({
      path: path.join(root, "test-results/v52-" + theme.id + ".png"),
    });
  }
  await open("超星学习通");
  await page.screenshot({
    path: path.join(root, "test-results/v52-learning.png"),
  });
  fs.writeFileSync(
    path.join(root, "test-results/v52-layout.json"),
    JSON.stringify(
      {
        passed: true,
        results,
        checks: [
          "independent home",
          "global Poseidon",
          "separate learning",
          "responsive typography",
          "eight themes",
          "32 tasks",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS " +
      results.length +
      " V5.2 layout/typography checks and global assistant on every route",
  );
} catch (e) {
  await (
    await app.firstWindow()
  ).screenshot({ path: path.join(root, "test-results/v52-failure.png") });
  fs.writeFileSync(
    path.join(root, "test-results/v52-layout.json"),
    JSON.stringify({ passed: false, results, error: e.message }, null, 2),
  );
  throw e;
} finally {
  await app.close();
}
