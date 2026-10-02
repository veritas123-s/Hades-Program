import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recentNews, groupNews } from "../src/news-window.mjs";
import { NewsService, parseArticle } from "../electron/news-service.mjs";
import { beijingDay } from "../src/briefing.mjs";
test("24小时窗口精确跨午夜，排除旧消息、未来、删除，日期精度另列", () => {
  const now = Date.parse("2026-09-30T08:00:00+08:00"),
    base = { title: "消息", url: "https://news.sjtu.edu.cn/", source: "学校" };
  const rows = [
    { ...base, id: "edge", publishedAt: now - 86400000 },
    { ...base, id: "yesterday", publishedAt: now - 16 * 3600000 },
    { ...base, id: "old", publishedAt: now - 86400001 },
    { ...base, id: "future", publishedAt: now + 1 },
    { ...base, id: "deleted", publishedAt: now - 1, deletedAt: 1 },
    {
      ...base,
      id: "dateonly",
      publishedAt: now - 8 * 3600000,
      date: "2026-09-30",
      publishedPrecision: "day",
    },
  ];
  const before = JSON.stringify(rows),
    result = recentNews(rows, now);
  assert.deepEqual(
    result.groups.map((g) => g.items[0].id),
    ["yesterday", "edge"],
  );
  assert.equal(result.uncertainGroups[0].items[0].id, "dateonly");
  assert.equal(JSON.stringify(rows), before);
});
test("转载合并保留每个来源，短标题及不同活动日期不误并，删除成员不复活", () => {
  const base = {
    title: "2026年校园医学与科研交流讲座报名通知",
    source: "甲",
    publishedAt: 1,
  };
  const rows = [
    { ...base, id: "a", url: "https://mp.weixin.qq.com/s/article?tracking=a" },
    {
      ...base,
      id: "b",
      source: "乙",
      url: "https://mp.weixin.qq.com/s/article?tracking=b",
      publishedAt: 2,
    },
    {
      ...base,
      id: "c",
      deletedAt: 2,
      url: "https://mp.weixin.qq.com/s/article",
    },
  ];
  const groups = groupNews(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
  assert.equal(
    groupNews([
      { ...base, id: "x", title: "通知" },
      { ...base, id: "y", title: "通知" },
    ]).length,
    2,
  );
  assert.equal(
    groupNews([
      { ...base, id: "x", activityDate: "2026-09-30" },
      { ...base, id: "y", activityDate: "2026-10-01" },
    ]).length,
    2,
  );
});
test("一键采集只新增最近24小时，保留历史缓存和删除状态，拒绝异常窗口", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-window-"));
  const stamp = Math.floor(Date.now() / 1000) - 600;
  const html = `<ul class="news-list"><li><h3><a>当日合成校园讲座通知示例</a></h3><span class="all-time-y2">上海交通大学</span><script>timeConvert('${stamp}')</script></li><li><h3><a>旧合成校园讲座通知示例</a></h3><span class="all-time-y2">上海交通大学</span><script>timeConvert('${stamp - 172800}')</script></li></ul>`;
  const service = new NewsService({
    directory,
    fetcher: async (url) =>
      new Response(
        String(url).includes("weixin.sogou.com") ? html : "<html></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
  });
  service.data.followedSources = ["上海交通大学"];
  service.merge([
    { id: "history", title: "历史", publishedAt: stamp * 1000 - 172800000 },
  ]);
  await service.collect({ windowHours: 24 });
  assert.equal(service.data.items.length, 2);
  assert.ok(service.data.items.some((x) => x.id === "history"));
  const id = service.status().recent.groups[0].items[0].id;
  service.remove({ id });
  await service.collect();
  assert.equal(service.status().recent.groups.length, 0);
  await assert.rejects(service.collect({ windowHours: 48 }), /24小时/);
  assert.equal(
    parseArticle(
      "<h1>合成</h1>发布日期：2026-09-30",
      "https://mp.weixin.qq.com/s/test",
    ).publishedPrecision,
    "day",
  );
  service.stop();
});
