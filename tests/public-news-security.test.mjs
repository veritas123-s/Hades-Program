import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  articleCover,
  newsImageURL,
  loadNewsThumbnail,
} from "../electron/news-images.mjs";
import { publicResponse, boundedBytes } from "../electron/public-fetch.mjs";
import {
  newsURL,
  parseUniversityIndex,
  NewsService,
} from "../electron/news-service.mjs";
import { decodeNews, repairNewsText } from "../electron/news-text.mjs";
import { articleBody } from "../electron/news-markup.mjs";
test("空封面和非图片 meta 不再把文章网址当作封面", () => {
  const url = "https://www.shsmu.edu.cn/news/info/1002/31074.htm";
  assert.equal(newsImageURL("", url), "");
  assert.equal(
    articleCover('<meta charset="utf-8"><img data-src="/cover.jpg">', url),
    "https://www.shsmu.edu.cn/cover.jpg",
  );
});
test("嵌套公众号正文完整保留，脚本和样式不当成文字或图片入口", () => {
  const body = articleBody(
    '<div id="js_content"><div>第一段</div><p>第二段</p><img data-src="https://mmbiz.qpic.cn/cover.jpg"><script>"</div>"</script></div>外部导航',
  );
  assert.match(body, /第二段/);
  assert.ok(!body.includes("外部导航") && !body.includes("script"));
  assert.equal(
    articleCover(body, "https://mp.weixin.qq.com/s/test"),
    "https://mmbiz.qpic.cn/cover.jpg",
  );
});
test("公开请求逐跳检查，拒绝本机、内网、凭据与伪装域，可信相对跳转可用", async () => {
  for (const target of [
    "https://127.0.0.1/admin",
    "https://169.254.169.254/",
    "https://10.0.0.1/",
    "https://news.sjtu.edu.cn.evil.invalid/",
    "https://user:password@news.sjtu.edu.cn/",
  ]) {
    let requests = 0;
    await assert.rejects(
      publicResponse("https://news.sjtu.edu.cn/a", {
        validate: newsURL,
        fetcher: async () => {
          requests++;
          return new Response(null, {
            status: 302,
            headers: { location: target },
          });
        },
      }),
    );
    assert.equal(requests, 1);
  }
  let requests = 0;
  const response = await publicResponse("https://news.sjtu.edu.cn/a", {
    validate: newsURL,
    fetcher: async (url, options) => {
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "manual");
      return ++requests === 1
        ? new Response(null, { status: 302, headers: { location: "/b" } })
        : new Response("public");
    },
  });
  assert.equal(await response.text(), "public");
  await assert.rejects(boundedBytes(new Response("12345"), 4), /过大/);
});
test("巨大图片在原生解码前拒绝，HTML伪装图片也拒绝", async () => {
  let decoded = 0;
  const b = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b);
  b.write("IHDR", 12);
  b.writeUInt32BE(100000, 16);
  b.writeUInt32BE(100000, 20);
  for (const body of [b, Buffer.from("<script>steal()</script>")])
    assert.equal(
      await loadNewsThumbnail(
        "https://news.sjtu.edu.cn/a.png",
        {
          createFromBuffer() {
            decoded++;
            throw Error();
          },
        },
        async () =>
          new Response(body, { headers: { "content-type": "image/png" } }),
      ),
      "",
    );
  assert.equal(decoded, 0);
});
test("停滞的公开响应体到时终止，不永久卡住采集", async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30);
  try {
    await assert.rejects(
      boundedBytes(
        new Response(new ReadableStream({ start() {} })),
        1000,
        controller.signal,
      ),
    );
  } finally {
    clearTimeout(timeout);
  }
});
test("错误编码声明与可逆乱码修复，列表显示日期优先于网址日期", () => {
  assert.equal(
    decodeNews(Buffer.from("上海交通大学"), "text/html;charset=gbk"),
    "上海交通大学",
  );
  assert.equal(repairNewsText("ä¸Šæµ·"), "上海");
  const rows = parseUniversityIndex(
    '<li><a href="/zhxw/20261002/1.html"><h2>合成新闻</h2><span>2026年09月30日</span></a></li>',
  );
  assert.equal(rows[0].date, "2026-09-30");
});
test("同一原文日期或标题修正不复活已删除快讯", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-news-security-"),
  );
  try {
    const service = new NewsService({ directory });
    service.data.items = [
      {
        id: "old",
        url: "https://mp.weixin.qq.com/s/fixture",
        publishedAt: 1,
        title: "旧标题",
        deletedAt: 123,
      },
    ];
    service.merge([
      {
        id: "new",
        url: "https://mp.weixin.qq.com/s/fixture",
        publishedAt: 2,
        title: "修正标题",
      },
    ]);
    assert.equal(service.data.items.length, 1);
    assert.equal(service.data.items[0].id, "old");
    assert.equal(service.data.items[0].deletedAt, 123);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
