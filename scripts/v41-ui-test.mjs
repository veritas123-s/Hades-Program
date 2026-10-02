import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
import { beijingDay } from "../src/briefing.mjs";
const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-v41-ui-"));
const profile = fixtureProfile(directory);
fs.mkdirSync(profile, { recursive: true });
const item = {
  id: "synthetic-campus-news",
  source: "合成来源",
  title: "校园讲座测试消息",
  url: "https://news.sjtu.edu.cn/",
  date: beijingDay(),
  activityDate: beijingDay(),
  publishedAt: Date.now() - 10000,
  excerpt: "仅用于离线界面验证",
  deletedAt: null,
};
fs.writeFileSync(
  path.join(profile, "campus-news.json"),
  JSON.stringify({
    version: 1,
    automatic: false,
    items: [item],
    coverage: [{ source: "合成来源", status: "partial", note: "合成测试" }],
    summary: {
      date: beijingDay(),
      kind: "activities",
      text: "今日活动：[校园活动](https://news.sjtu.edu.cn/zhxw/20260930/123.html)",
    },
  }),
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
let app;
const checks = [];
try {
  app = await launchAuthenticated({
    ...(process.argv[2]
      ? { executablePath: path.resolve(process.argv[2]), args: [] }
      : { args: [root] }),
    env,
  });
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  for (const title of ["效率工具", "教务信息", "校园快讯"])
    assert.ok(
      await page
        .locator(".nav-group-button")
        .getByText(title, { exact: true })
        .isVisible(),
    );
  checks.push("三类导航可见");
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    title: getComputedStyle(document.querySelector("h1")).fontFamily,
  }));
  assert.match(fonts.body, /YaHei|PingFang/);
  assert.match(fonts.title, /YaHei|PingFang/);
  checks.push("统一清晰界面字体");
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  assert.equal(await page.locator(".sidebar nav > button").count(), 3);
  await page.getByRole("button", { name: "效率工具板块", exact: true }).click();
  await page
    .getByRole("region", { name: "效率工具菜单" })
    .getByRole("button", { name: "任务清单", exact: true })
    .click();
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  checks.push("一键收起仅保留三大板块，弹出菜单可导航");
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await page.screenshot({ path: path.join(root, "test-results/v41-home.png") });
  await page.getByRole("button", { name: "校园快讯", exact: true }).click();
  await page.getByRole("button", { name: "当日活动", exact: true }).click();
  await page.getByRole("heading", { name: item.title }).waitFor();
  await app.evaluate(({ shell, app }) => {
    shell.openExternal = async (url) => {
      app.__lastLink = url;
      return "";
    };
  });
  await page.getByRole("link", { name: "校园活动", exact: true }).click();
  assert.equal(
    await app.evaluate(({ app }) => app.__lastLink),
    "https://news.sjtu.edu.cn/zhxw/20260930/123.html",
  );
  checks.push("整理正文的网址点击调用受限网页跳转");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page
    .getByRole("heading", { name: item.title })
    .waitFor({ state: "hidden" });
  assert.equal(
    await page.getByRole("heading", { name: item.title }).count(),
    0,
  );
  await page.getByRole("button", { name: "已删除", exact: true }).click();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "当日活动", exact: true }).click();
  await page.getByRole("heading", { name: item.title }).waitFor();
  checks.push("消息删除恢复与日期筛选");
  await page.screenshot({ path: path.join(root, "test-results/v41-news.png") });
  await page.evaluate(() =>
    window.veritas.call("assistant.chat", { text: "帮我关注测试组织公众号" }),
  );
  assert.ok(
    (
      await page.evaluate(() => window.veritas.call("state"))
    ).news.sources.includes("测试组织"),
  );
  await page.getByRole("button", { name: "组织专栏", exact: true }).click();
  await page.getByRole("button", { name: "测试组织", exact: true }).waitFor();
  checks.push("单句关注落入个人组织专栏");
  await page.evaluate(() =>
    window.veritas.call("assistant.chat", {
      text: "添加一个考试倒计时小组件，日期2026-12-20，叫期末考试",
    }),
  );
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await page.locator(".home-extras > summary").click();
  await page.getByRole("heading", { name: "期末考试", exact: true }).waitFor();
  await page.getByRole("button", { name: "删除期末考试", exact: true }).click();
  assert.equal(
    await page.getByRole("heading", { name: "期末考试", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "主题与小组件", exact: true }).click();
  await page.getByRole("button", { name: "小组件", exact: true }).click();
  await page.getByRole("button", { name: "添加期末考试", exact: true }).click();
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await page.locator(".home-extras > summary").click();
  await page.getByRole("heading", { name: "期末考试", exact: true }).waitFor();
  checks.push("单句新增自定义组件、删除与恢复");
  await page.getByRole("button", { name: "校园与课表", exact: true }).click();
  await page.getByRole("button", { name: /学习通 · / }).waitFor();
  await page.getByRole("button", { name: "Canvas", exact: true }).waitFor();
  checks.push("醒目的学术平台入口");
  await page.screenshot({
    path: path.join(root, "test-results/v41-academic.png"),
  });

  await page.getByRole("button", { name: "设置与数据", exact: true }).click();
  await page.getByRole("heading", { name: "设置", exact: true }).waitFor();
  assert.equal(await page.locator(".page-heading p:not(.eyebrow)").count(), 0);
  await page.getByLabel("番茄专注（分钟）").fill("38");
  await page
    .getByRole("button", { name: "收起专注与提醒", exact: true })
    .click();
  assert.equal(await page.getByLabel("番茄专注（分钟）").isVisible(), false);
  await page
    .getByRole("button", { name: "展开专注与提醒", exact: true })
    .click();
  assert.equal(await page.getByLabel("番茄专注（分钟）").inputValue(), "38");
  await page.getByRole("tab", { name: "帮助", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "使用说明", exact: true })
      .isVisible(),
  );
  assert.equal(await page.getByLabel("番茄专注（分钟）").isVisible(), false);
  await page.getByRole("tab", { name: "专注与提醒", exact: true }).click();
  assert.equal(await page.getByLabel("番茄专注（分钟）").inputValue(), "38");
  await page.screenshot({
    path: path.join(root, "test-results/v41-settings.png"),
  });
  checks.push("设置分类、手册入口与折叠保持未保存输入");
  await page
    .getByRole("button", { name: "收起专注与提醒", exact: true })
    .click();
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await page.getByRole("button", { name: "设置与数据", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "展开专注与提醒", exact: true })
      .isVisible(),
  );
  checks.push("面板收起状态在当前登录会话内跨页面保留");
  await page.getByRole("button", { name: "主题与小组件", exact: true }).click();
  assert.equal(await page.locator(".theme-choice").count(), THEMES.length);
  checks.push("精简文案后全部主题与自定义功能入口保留");
  await app.evaluate(({ net }) => {
    const original = net.fetch.bind(net);
    net.fetch = async (url, options) => {
      const u = new URL(url);
      if (
        !["weixin.sogou.com", "www.shsmu.edu.cn", "news.sjtu.edu.cn"].includes(
          u.hostname,
        )
      )
        return original(url, options);
      const source = u.searchParams.get("query"),
        stamp = Math.floor(Date.now() / 1000) - 120;
      const html =
        u.hostname === "weixin.sogou.com"
          ? '<ul class="news-list"><li><h3><a>校园医学科研交流讲座合成通知</a></h3><span class="all-time-y2">' +
            source +
            '</span><p class="txt-info">相同活动的不同来源</p><script>timeConvert("' +
            stamp +
            '")</script></li><li><h3><a>窗口外的旧通知</a></h3><span class="all-time-y2">' +
            source +
            '</span><script>timeConvert("' +
            (stamp - 172800) +
            '")</script></li></ul>'
          : "<html></html>";
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    };
  });
  await page.getByRole("button", { name: "快报与提醒", exact: true }).click();
  await page.getByRole("button", { name: "采集最新信息", exact: true }).click();
  await page
    .getByRole("button", { name: "展开最近24小时消息", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "校园医学科研交流讲座合成通知", exact: true })
    .waitFor();
  const recent = (await page.evaluate(() => window.veritas.call("state"))).news
    .recent;
  const group = recent.groups.find(
    (g) => g.title === "校园医学科研交流讲座合成通知",
  );
  assert.equal(group.items.length, 13);
  assert.equal(
    recent.groups.some((g) => g.title === "窗口外的旧通知"),
    false,
  );
  assert.equal(
    await page
      .getByRole("heading", {
        name: "校园医学科研交流讲座合成通知",
        exact: true,
      })
      .count(),
    1,
  );
  await page.screenshot({
    path: path.join(root, "test-results/v41-briefing.png"),
  });
  checks.push("实际按钮触发采集与快报更新，13个来源合并为一项、旧消息排除");
  await page.getByRole("button", { name: "快报与提醒", exact: true }).click();
  await page
    .getByRole("button", { name: "开通我的早晚报", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "开通我的早晚报" });
  await modal.waitFor();
  assert.equal(await modal.getByLabel("提醒渠道").inputValue(), "email");
  assert.ok(await modal.getByLabel("客户端授权码").isVisible());
  await modal.getByLabel("提醒渠道").selectOption("pushplus");
  assert.ok(await modal.getByLabel("我的 pushplus Token").isVisible());
  checks.push("默认邮件、PushPlus 可选");
  await page.screenshot({
    path: path.join(root, "test-results/v41-delivery.png"),
  });
  fs.writeFileSync(
    path.join(root, "test-results/v41-ui.json"),
    JSON.stringify({ passed: true, checks, fonts }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await app?.close();
}
