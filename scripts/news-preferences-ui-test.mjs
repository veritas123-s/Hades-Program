import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { beijingDay } from "../src/briefing.mjs";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "medstack-news-subscription-"),
);
const profile = fixtureProfile(directory);
fs.mkdirSync(profile, { recursive: true });
const news = {
  version: 1,
  automatic: false,
  items: [
    {
      id: "academic",
      title: "合成 IgG4 学术讲座",
      excerpt: "合成科研消息",
      source: "合成学校",
      publishedAt: Date.now() - 60000,
      date: beijingDay(),
      url: "https://news.sjtu.edu.cn/academic",
    },
    {
      id: "life",
      title: "合成社团体育活动",
      source: "合成学校",
      publishedAt: Date.now() - 120000,
      date: beijingDay(),
      url: "https://news.sjtu.edu.cn/life",
    },
    {
      id: "deleted",
      title: "合成 IgG4 旧论文",
      source: "合成学校",
      deletedAt: 1,
      publishedAt: Date.now() - 180000,
      date: beijingDay(),
      url: "https://news.sjtu.edu.cn/deleted",
    },
  ],
};
fs.writeFileSync(path.join(profile, "campus-news.json"), JSON.stringify(news));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const options = process.argv[2]
  ? { executablePath: path.resolve(process.argv[2]), args: [], env }
  : { args: [path.resolve(".")], env };
let app = await launchAuthenticated(options);
const openNews = async () => {
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "校园快讯", exact: true })
    .click();
  await page.getByRole("heading", { name: "校园快讯", exact: true }).waitFor();
  return page;
};
try {
  let page = await openNews();
  await page
    .getByRole("button", { name: "展开筛选与订阅", exact: true })
    .click();
  await page.getByLabel("订阅关键词", { exact: true }).fill("igG4");
  await page.waitForTimeout(2200);
  assert.equal(
    await page.getByLabel("订阅关键词", { exact: true }).inputValue(),
    "igG4",
  );
  await page.getByRole("button", { name: "保存订阅", exact: true }).click();
  await page.getByRole("button", { name: "我的订阅", exact: true }).click();
  await page.locator(".news-article-row:visible").first().waitFor();
  assert.equal(await page.locator(".news-article-row:visible").count(), 1);
  await page.getByLabel("快讯分类").selectOption("life");
  assert.equal(await page.locator(".news-article-row:visible").count(), 0);
  await page.getByLabel("快讯分类").selectOption("all");
  await page.getByLabel("屏蔽学术科研").check();
  await page.getByRole("button", { name: "保存订阅", exact: true }).click();
  await page.getByText("暂无符合订阅条件的消息", { exact: true }).waitFor();
  await page.getByRole("button", { name: "最近24小时", exact: true }).click();
  assert.equal(await page.locator(".recent-news-card:visible").count(), 1);
  const raw = JSON.parse(
    fs.readFileSync(path.join(profile, "campus-news.json")),
  );
  assert.equal(raw.items.length, 3);
  assert.equal(raw.items.find((x) => x.id === "deleted").deletedAt, 1);
  await app.close();
  app = await launchAuthenticated(options);
  page = await openNews();
  assert.equal(await page.locator(".recent-news-card:visible").count(), 1);
  await page
    .getByRole("button", { name: "展开筛选与订阅", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("订阅关键词", { exact: true }).inputValue(),
    "igG4",
  );
  assert.ok(await page.getByLabel("屏蔽学术科研").isChecked());
  await page.getByRole("button", { name: "重置筛选", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".recent-news-card").length === 2,
  );
  await page.getByLabel("屏蔽关键词", { exact: true }).fill("体育");
  await page.getByRole("button", { name: "保存订阅", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".recent-news-card").length === 1,
  );
  for (const [width, height] of [
    [1600, 900],
    [1100, 760],
    [800, 680],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0].setContentSize(...size),
      [width, height],
    );
    await page.waitForTimeout(150);
    assert.ok(
      await page
        .locator(".page-viewport")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
    );
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1400, 900),
  );
  await page.screenshot({ path: "test-results/news-subscriptions.png" });
  await page.getByRole("button", { name: "设置与数据", exact: true }).click();
  await page.getByRole("tab", { name: "关于", exact: true }).click();
  await page
    .getByRole("heading", { name: "鸣谢 SJTU Agent", exact: true })
    .waitFor();
  await page
    .getByText("Copyright (c) 2026 kuan-er · MIT License", { exact: true })
    .waitFor();
  fs.writeFileSync(
    "test-results/news-preferences-ui.json",
    JSON.stringify(
      {
        passed: true,
        synthetic: true,
        packaged: !!process.argv[2],
        subscription: true,
        categoryFilter: true,
        blockKeywords: true,
        blockCategory: true,
        restartPersistence: true,
        deletionPreserved: true,
        reset: true,
        widths: 3,
        attribution: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS news subscriptions, filters, exclusions, reset, persistence, deletion preservation, attribution and responsive layout",
  );
} finally {
  await app.close();
}
