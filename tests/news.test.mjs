import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildFeed, beijingDay } from "../src/briefing.mjs";
import { initialState } from "../src/domain.mjs";
import {
  NewsService,
  newsURL,
  parseWechatIndex,
  parseUniversityIndex,
  parseArticle,
} from "../electron/news-service.mjs";
const source = "上海交通大学",
  stamp = Math.floor(Date.now() / 1000) - 100;
const row = (account = source) =>
  `<li><div class="txt-box"><h3><a href="/link">标题 &amp; 学术活动</a></h3><p class="txt-info">摘要</p><span class="all-time-y2">${account}</span><script>timeConvert('${stamp}')</script></div></li>`;
test("公众号公开索引严格匹配发布者与日期，不把关键词命中归入官方账号", () => {
  assert.equal(parseWechatIndex(row() + row("其他同名账号"), source).length, 1);
  assert.equal(
    parseWechatIndex(row().replace(String(stamp), "0"), source).length,
    0,
  );
  assert.equal(parseWechatIndex(row(), source)[0].title, "标题 & 学术活动");
  assert.equal(
    parseArticle("<h1>没有发布日期</h1>", "https://mp.weixin.qq.com/s/example"),
    null,
  );
  assert.throws(() => newsURL("https://mp.weixin.qq.com.evil.example/"));
  assert.throws(() => newsURL("http://127.0.0.1/"));
  assert.throws(() => newsURL("https://user:pass@mp.weixin.qq.com/"));
});
test("采集更新保留删除墓碑，缺失来源不抹掉缓存；登录失效不提交迟到结果", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-news-test-"));
  let allowed = true;
  const service = new NewsService({
    directory,
    allowed: () => allowed,
    fetcher: async () => Response.json({}),
  });
  const item = parseWechatIndex(row(), source)[0];
  service.merge([item]);
  service.remove({ id: item.id });
  service.merge([item]);
  assert.ok(service.data.items[0].deletedAt);
  const count = service.data.items.length;
  await service.collect();
  assert.equal(service.data.items.length, count);
  assert.ok(service.data.coverage.every((x) => x.status === "unavailable"));
  const saved = fs.readFileSync(service.file, "utf8");
  allowed = false;
  await assert.rejects(service.collect(), /登录/);
  assert.equal(fs.readFileSync(service.file, "utf8"), saved);
  service.stop();
});
test("快讯摘要只同步当日未删除消息，旧摘要不能混入今天", () => {
  const today = beijingDay();
  const base = {
    source: "学校",
    title: "合成消息",
    url: "https://news.sjtu.edu.cn/",
    excerpt: "公开内容",
    date: today,
    activityDate: today,
  };
  const feed = buildFeed(initialState(), Date.now(), {
    items: [
      base,
      { ...base, deletedAt: 1 },
      { ...base, activityDate: "2020-01-01" },
      { ...base, activityDate: undefined },
    ],
    summary: { date: "2020-01-01", text: "过期摘要" },
    coverage: [],
  });
  assert.equal(feed.campus_news.items.length, 1);
  assert.equal(feed.campus_news.summary, "");
  assert.equal(feed.campus_news.items[0].date, undefined);
});
test("文章读取过程中登出不会保存迟到内容；损坏快讯缓存先备份", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-news-race-"));
  let allowed = true,
    release;
  const service = new NewsService({
    directory,
    allowed: () => allowed,
    fetcher: () => new Promise((resolve) => (release = resolve)),
  });
  const pending = service.import({
    url: "https://mp.weixin.qq.com/s/synthetic",
  });
  allowed = false;
  service.stop();
  release(
    new Response(
      `<h1>合成文章</h1><script>var nickname="合成来源";var ct=${stamp};</script>`,
    ),
  );
  await assert.rejects(pending, /登录状态/);
  assert.equal(fs.existsSync(service.file), false);
  fs.writeFileSync(service.file, "broken-json");
  const recovery = new NewsService({ directory });
  assert.equal(recovery.data.items.length, 0);
  assert.ok(fs.readdirSync(directory).some((x) => x.includes("unreadable")));
  assert.equal(fs.readFileSync(service.file, "utf8"), "broken-json");
});
