import test from "node:test";
import assert from "node:assert/strict";
import {
  articleCover,
  newsImageURL,
  loadNewsThumbnail,
} from "../electron/news-images.mjs";
import {
  parseArticle,
  parseWechatIndex,
  parseUniversityIndex,
  NewsService,
} from "../electron/news-service.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const fixtureImage = () => {
  const b = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b);
  b.write("IHDR", 12);
  b.writeUInt32BE(800, 16);
  b.writeUInt32BE(600, 20);
  return b;
};

test("封面解析支持学校相对链接、微信懒加载与倒序 meta 属性，拒绝外站和本机地址", () => {
  assert.equal(
    articleCover(
      '<meta content="https://mmbiz.qpic.cn/image?a=1&amp;b=2" property="og:image">',
      "https://mp.weixin.qq.com/s/a",
    ),
    "https://mmbiz.qpic.cn/image?a=1&b=2",
  );
  assert.equal(
    articleCover(
      '<img data-src="/cover.jpg">',
      "https://news.sjtu.edu.cn/zhxw/a.html",
    ),
    "https://news.sjtu.edu.cn/cover.jpg",
  );
  for (const url of [
    "https://127.0.0.1/a",
    "https://mmbiz.qpic.cn.evil.example/a",
    "https://u:p@news.sjtu.edu.cn/a",
    "http://news.sjtu.edu.cn/a",
    "data:image/svg+xml,a",
    "https://news.sjtu.edu.cn:444/a",
  ])
    assert.equal(newsImageURL(url), "");
});
test("三种采集入口保留真实封面 URL，正文仍作为纯文本", () => {
  const stamp = Math.floor(Date.now() / 1000) - 100;
  const html = `<h1>合成活动</h1><script>var ct=${stamp};</script><div id="js_content"><img data-src="https://mmbiz.qpic.cn/a.jpg">纯文本</div>`;
  const article = parseArticle(html, "https://mp.weixin.qq.com/s/a");
  assert.equal(article.imageURL, "https://mmbiz.qpic.cn/a.jpg");
  assert.equal(article.excerpt, "纯文本");
  assert.ok(
    parseWechatIndex(
      `<li><img src="https://img01.sogoucdn.com/a.jpg"><h3><a>合成</a></h3><span class="all-time-y2">合成组织</span><script>timeConvert('${stamp}')</script></li>`,
      "合成组织",
    )[0].imageURL,
  );
  assert.ok(
    parseUniversityIndex(
      '<li><a href="/zhxw/20260930/1.html"><img src="/cover.jpg"><h2>合成</h2></a></li>',
    )[0].imageURL,
  );
});
test("封面请求无凭据、拒绝重定向及非图片，缩略图有体积上限", async () => {
  let options;
  const native = {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 800, height: 600 }),
      resize: ({ width }) => ({
        toJPEG: () => Buffer.from(`thumbnail-${width}`),
      }),
    }),
  };
  const image = await loadNewsThumbnail(
    "https://news.sjtu.edu.cn/a.jpg",
    native,
    async (_url, o) => {
      options = o;
      return new Response(fixtureImage(), {
        headers: { "content-type": "image/jpeg" },
      });
    },
  );
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "manual");
  assert.equal(
    Buffer.from(image.split(",")[1], "base64").toString(),
    "thumbnail-480",
  );
  assert.equal(
    await loadNewsThumbnail(
      "https://news.sjtu.edu.cn/a.svg",
      native,
      async () =>
        new Response("<svg/>", {
          headers: { "content-type": "image/svg+xml" },
        }),
    ),
    "",
  );
  assert.equal(
    await loadNewsThumbnail(
      "https://news.sjtu.edu.cn/a.jpg",
      native,
      async () =>
        new Response(Buffer.alloc(2 * 1024 * 1024 + 1), {
          headers: { "content-type": "image/jpeg" },
        }),
    ),
    "",
  );
});
test("按已收录文章 ID 读取封面，登出后丢弃迟到图片且不能越权取任意 URL", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-images-"));
  let allowed = true,
    release;
  const service = new NewsService({
    directory,
    allowed: () => allowed,
    nativeImage: {
      createFromBuffer: () => ({
        isEmpty: () => false,
        getSize: () => ({ width: 100, height: 100 }),
        toJPEG: () => Buffer.from("synthetic"),
      }),
    },
    imageFetcher: () => new Promise((resolve) => (release = resolve)),
  });
  service.data.items = [
    {
      id: "synthetic",
      imageURL: "https://mmbiz.qpic.cn/a.jpg",
      deletedAt: null,
    },
  ];
  assert.deepEqual(
    await service.image({ id: "unknown", url: "https://127.0.0.1" }),
    { image: "" },
  );
  const pending = service.image({ id: "synthetic" });
  allowed = false;
  service.stop();
  release(new Response("image", { headers: { "content-type": "image/jpeg" } }));
  assert.deepEqual(await pending, { image: "" });
  await assert.rejects(service.image({ id: "synthetic" }), /登录/);
  fs.rmSync(directory, { recursive: true, force: true });
});
