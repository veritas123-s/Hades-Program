import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NewsService, WECHAT_SOURCES } from "../electron/news-service.mjs";
import { refreshLabel } from "../src/news-refresh.mjs";
const directory = () => fs.mkdtempSync(path.join(os.tmpdir(), "medstack-shared-news-"));

test("共享快讯拒绝危险链接并保留个人删除、订阅与离线缓存", async () => {
  const now = Date.now(); let fail = false, malicious = false;
  const row = { id: "synthetic", source: WECHAT_SOURCES[0], title: "合成校园消息", publishedAt: now - 1000, date: "2026-10-04", excerpt: "合成数据", url: "https://mp.weixin.qq.com/s/synthetic" };
  const service = new NewsService({ directory: directory(), sharedFetcher: async () => {
    if (fail) throw Error("offline");
    return { version: 1, serverNow: now, nextRunAt: now + 25 * 60000, sources: WECHAT_SOURCES, coverage: [], items: [{ ...row, url: malicious ? "http://127.0.0.1/private" : row.url }] };
  }});
  service.data.followedSources = ["合成个人订阅"]; service.data.items = [{ ...row, deletedAt: 123 }];
  await service.collect(); assert.equal(service.data.items[0].deletedAt, 123);
  assert.deepEqual(service.sources(), ["合成个人订阅"]);
  const before = JSON.stringify(service.data.items);
  malicious = true; await assert.rejects(service.collect()); assert.equal(JSON.stringify(service.data.items), before);
  fail = true; await assert.rejects(service.collect()); assert.equal(JSON.stringify(service.data.items), before);
  assert.ok(service.data.sharedError.includes("保留")); service.stop();
});

test("倒计时按服务器时间校准，归零后等待实际结果", () => {
  const now = Date.now(), shared = { serverNow: now + 9 * 3600000, receivedAt: now, nextRunAt: now + 9 * 3600000 + 25 * 60000 };
  assert.equal(refreshLabel(shared, now + 1000), "距下次刷新 00:24:59");
  assert.equal(refreshLabel(shared, now + 26 * 60000), "等待服务器刷新结果");
  assert.equal(refreshLabel({ ...shared, busy: true }), "服务器正在采集");
  assert.equal(refreshLabel(null), "等待服务器刷新计划");
});

test("历史索引收录与最近24小时视图分离，失败保留历史", async () => {
  const stamp = Math.floor(Date.now() / 1000) - 14 * 86400;
  const html = `<ul class="news-list"><li><h3><a>合成历史校园文章</a></h3><p class="txt-info">合成摘要</p><span class="all-time-y2">上海交通大学</span><script>timeConvert('${stamp}')</script></li></ul>`;
  for (const retainIndexed of [false, true]) {
    const service = new NewsService({ directory: directory(), retainIndexed });
    service.read = async url => new URL(url).hostname === "weixin.sogou.com" ? html : "";
    await service.collect(); assert.equal(service.data.items.length, retainIndexed ? 1 : 0);
    assert.equal(service.status().recent.count, 0);
    service.read = async () => { throw Error("offline"); };
    await service.collect(); assert.equal(service.data.items.length, retainIndexed ? 1 : 0);
    service.stop();
  }
});
