import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { newsPreferences, selectNews } from "../src/news-preferences.mjs";
import { NewsService } from "../electron/news-service.mjs";
const now = Date.now();
const rows = [
  {
    id: "a",
    title: "校园学术讲座",
    source: "合成学校",
    publishedAt: now - 3600000,
  },
  { id: "b", title: "奖学金报名", source: "合成学校", publishedAt: now - 1000 },
  {
    id: "c",
    title: "社团体育活动",
    source: "合成学校",
    publishedAt: now - 2000,
  },
  { id: "d", title: "校园科研论文", deletedAt: 1, publishedAt: now },
];
test("订阅按主题匹配排序，屏蔽优先且删除项不再出现", () => {
  const prefs = {
    subscribedCategories: ["academic", "opportunity"],
    blockedKeywords: ["报名"],
  };
  assert.deepEqual(
    selectNews(rows, prefs, { subscribed: true, now }).map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(
    selectNews(rows, { blockedCategories: ["academic"] }).map((x) => x.id),
    ["b", "c"],
  );
  assert.equal(selectNews(rows, {}, { subscribed: true }).length, 0);
  assert.equal(rows[0].categories, undefined);
});
test("保留屏蔽词Unicode匹配，旧订阅关键词不再参与筛选或持久化", () => {
  assert.equal(newsPreferences({ keywords: ["legacy"] }).keywords, undefined);
  assert.equal(selectNews(rows, { keywords: ["校园"] }, { subscribed: true }).length, 0);
  assert.throws(() => newsPreferences({ blockedKeywords: "wrong" }));
  assert.throws(() => newsPreferences({ blockedCategories: ["unknown"] }));
  assert.throws(() => newsPreferences({ blockedKeywords: ["x".repeat(41)] }));
  assert.equal(
    selectNews(
      [{ title: "ＣＡＭＰＵＳ", publishedAt: now }],
      { blockedKeywords: ["campus"] },
    ).length,
    0,
  );
});
test("账号订阅可持久化与重置，屏蔽不修改文章或已关注来源，失败回滚", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-news-preferences-"),
  );
  try {
    const service = new NewsService({ directory });
    service.data.automatic = false;
    service.data.items = rows.map((row) => ({
      ...row,
      excerpt: "",
      source: row.source || "",
    }));
    service.follow({ name: "合成科研组织" });
    const original = JSON.stringify(service.data.items),
      sources = service.sources();
    service.configure({ preferences: { subscribedCategories: ["academic"] } });
    const restored = new NewsService({ directory });
    assert.equal(restored.status().subscriptions.length, 1);
    restored.configure({ preferences: {} });
    assert.equal(JSON.stringify(restored.data.items), original);
    assert.deepEqual(restored.sources(), sources);
    const before = JSON.stringify(service.data);
    service.save = () => {
      throw Error("synthetic write failure");
    };
    assert.throws(() =>
      service.configure({ preferences: { subscribedCategories: ["study"] } }),
    );
    assert.equal(JSON.stringify(service.data), before);
    const locked = new NewsService({ directory, allowed: () => false });
    assert.throws(() => locked.configure({ preferences: {} }), /登录/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
