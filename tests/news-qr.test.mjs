import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  inspectWechatQR,
  wechatEntryURL,
  qrPixels,
  decodeWechatQR,
} from "../electron/news-qr.mjs";
import { NewsService } from "../electron/news-service.mjs";

const source = "合成公众号";
const entry = { imageURL: "https://www.shsmu.edu.cn/qr.png" };
const stamp = Math.floor(Date.now() / 1000) - 10;
const article = (name = source) =>
  `<h1>合成文章</h1><script>var nickname="${name}";var ct=${stamp};</script><div id="js_content">公开正文</div>`;
const withService = async (options, run) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-qr-"));
  const service = new NewsService({
    directory,
    nativeImage: {},
    qrEntries: { [source]: entry },
    ...options,
  });
  service.data.followedSources = [source];
  try {
    await run(service);
  } finally {
    service.stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

test("二维码只接受微信账号/文章入口，老 HTTP 码先升级 HTTPS，拒绝外站和凭据", () => {
  assert.equal(
    wechatEntryURL("http://weixin.qq.com/r/fixture"),
    "https://weixin.qq.com/r/fixture",
  );
  assert.equal(
    wechatEntryURL(
      "https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=fixture",
    ),
    "https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=fixture",
  );
  for (const url of [
    "https://127.0.0.1/",
    "https://weixin.qq.com.evil.invalid/r/a",
    "https://user:secret@weixin.qq.com/r/a",
    "https://weixin.qq.com:444/r/a",
    "weixin://contacts/profile/fixture",
    "https://weixin.qq.com/d",
    "https://mp.weixin.qq.com/mp/profile_ext?action=getmsg",
    "https://weixin.qq.com/r/a#x",
  ])
    assert.throws(() => wechatEntryURL(url));
});

test("客户端下载跳转仅后台检查，不执行脚本、不启动微信、不算读取到文章", async () => {
  const requested = [];
  const result = await inspectWechatQR({
    entry,
    decoder: async () => "http://weixin.qq.com/r/fixture",
    fetcher: async (url, options) => {
      requested.push(url);
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "manual");
      return url.endsWith("qr.png")
        ? new Response("fixture", { headers: { "content-type": "image/png" } })
        : new Response(
            '<script>window.location="http://weixin.qq.com/d"</script>',
          );
    },
  });
  assert.equal(result.status, "client-required");
  assert.deepEqual(result.urls, []);
  assert.deepEqual(requested, [
    entry.imageURL,
    "https://weixin.qq.com/r/fixture",
  ]);
});

test("二维码入口遇验证、跳转内网或超大图片，终止并交给原采集流程回退", async () => {
  const fetcher = (body) => async (url) =>
    url.endsWith("qr.png")
      ? new Response("fixture", { headers: { "content-type": "image/png" } })
      : body;
  assert.equal(
    (
      await inspectWechatQR({
        entry,
        decoder: async () => "https://weixin.qq.com/r/test",
        fetcher: fetcher(new Response("环境异常，请验证")),
      })
    ).status,
    "verification",
  );
  await assert.rejects(
    inspectWechatQR({
      entry,
      decoder: async () => "https://weixin.qq.com/r/test",
      fetcher: fetcher(
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/" },
        }),
      ),
    }),
  );
  let decoded = false;
  await assert.rejects(
    inspectWechatQR({
      entry,
      decoder: async () => {
        decoded = true;
      },
      fetcher: async () =>
        new Response("x", {
          headers: {
            "content-type": "image/png",
            "content-length": String(3 * 1024 * 1024),
          },
        }),
    }),
    /过大/,
  );
  assert.equal(decoded, false);
  await assert.rejects(
    inspectWechatQR({ entry: { imageURL: "https://localhost/a" } }),
    /不受信任/,
  );
});

test("后台文章候选仅允许微信原文，普通网页链接和脚本中的假文章被忽略", async () => {
  const result = await inspectWechatQR({
    entry,
    decoder: async () => "https://weixin.qq.com/r/test",
    fetcher: async (url) =>
      url.endsWith("qr.png")
        ? new Response("fixture", { headers: { "content-type": "image/png" } })
        : new Response(
            '<a href="https://mp.weixin.qq.com/s/real">原文</a><a href="https://evil.invalid/">外站</a><script><a href="https://mp.weixin.qq.com/s/fake">假链接</a></script>',
          ),
  });
  assert.equal(result.status, "public-links");
  assert.deepEqual(result.urls, ["https://mp.weixin.qq.com/s/real"]);
});

test("巨大二维码解压前拒绝，Windows BGRA 正确转换并合成白底", async () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(100000, 16);
  png.writeUInt32BE(100000, 20);
  let decoded = false;
  assert.throws(
    () =>
      qrPixels(png, {
        createFromBuffer() {
          decoded = true;
        },
      }),
    /尺寸/,
  );
  assert.equal(decoded, false);
  png.writeUInt32BE(32, 16);
  png.writeUInt32BE(32, 20);
  const bitmap = Buffer.alloc(32 * 32 * 4, 255);
  bitmap.set([10, 20, 30, 255, 0, 0, 0, 0]);
  const nativeImage = {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 32, height: 32 }),
      toBitmap: () => bitmap,
    }),
  };
  assert.deepEqual(
    [...new Uint8ClampedArray(qrPixels(png, nativeImage).pixels).slice(0, 8)],
    [30, 20, 10, 255, 255, 255, 255, 255],
  );
  await assert.rejects(decodeWechatQR(png, nativeImage), /入口/);
  await assert.rejects(
    decodeWechatQR(png, nativeImage, AbortSignal.abort()),
    /abort/i,
  );
});

test("二维码无法提供列表时自动回退公开索引，24小时内不重复扫码且不暴露后台入口", async () => {
  let inspected = 0;
  await withService(
    {
      qrInspector: async () => {
        inspected++;
        return { status: "client-required", urls: [] };
      },
      fetcher: async (url) =>
        new URL(url).hostname === "weixin.sogou.com"
          ? new Response(
              `<ul class="news-list"><li><h3><a>合成索引文章</a></h3><span class="all-time-y2">${source}</span><script>timeConvert('${stamp}')</script></li></ul>`,
            )
          : new Response(""),
    },
    async (service) => {
      await service.collect();
      await service.collect();
      assert.equal(inspected, 1);
      assert.equal(service.data.items.length, 1);
      assert.equal(
        service.data.coverage.find((x) => x.source === source).status,
        "partial",
      );
      assert.equal(service.status().qrOutcomes, undefined);
      assert.equal(JSON.stringify(service.status()).includes("qr.png"), false);
      assert.equal(
        fs.readFileSync(service.file, "utf8").includes("client-required"),
        false,
      );
    },
  );
});

test("二维码原文按账号核验，公开索引故障仍保留已读取内容及删除状态", async () => {
  await withService(
    {
      qrInspector: async () => ({
        status: "public-links",
        urls: [
          "https://mp.weixin.qq.com/s/ok",
          "https://mp.weixin.qq.com/s/other",
        ],
      }),
      fetcher: async (url) =>
        new Response(
          url.endsWith("/ok")
            ? article()
            : url.endsWith("/other")
              ? article("其他账号")
              : "环境异常",
        ),
    },
    async (service) => {
      await service.collect();
      assert.equal(service.data.items.length, 1);
      assert.equal(service.data.items[0].source, source);
      assert.equal(service.data.items[0].searchResult, undefined);
      assert.equal(
        service.data.coverage.find((x) => x.source === source).status,
        "partial",
      );
      service.remove({ id: service.data.items[0].id });
      await service.collect();
      assert.ok(service.data.items[0].deletedAt);
    },
  );
});

test("未配置二维码维持原采集路径；二维码故障不抹掉已有内容", async () => {
  await withService(
    {
      qrEntries: {},
      qrInspector: () => {
        throw Error("不应扫码");
      },
      fetcher: async () => new Response(""),
    },
    async (service) => {
      await service.collect();
      assert.equal(service.qrOutcomes.size, 0);
    },
  );
  await withService(
    {
      qrInspector: async () => {
        throw Error("故障");
      },
      fetcher: async () => new Response(""),
    },
    async (service) => {
      service.data.items = [
        {
          id: "cached",
          title: "缓存",
          publishedAt: Date.now(),
          date: "2026-10-03",
          source,
          url: "https://mp.weixin.qq.com/s/cached",
        },
      ];
      await service.collect();
      assert.equal(service.data.items.length, 1);
      assert.equal(
        service.data.coverage.find((x) => x.source === source).status,
        "unavailable",
      );
    },
  );
});

test("退出账号后丢弃迟到二维码结果，不保存入口缓存与文章", async () => {
  let allowed = true,
    release;
  await withService(
    {
      allowed: () => allowed,
      qrInspector: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
    async (service) => {
      const pending = service.qrArticles(
        source,
        service.generation,
        new AbortController().signal,
      );
      allowed = false;
      service.stop();
      release({
        status: "public-links",
        urls: ["https://mp.weixin.qq.com/s/late"],
      });
      assert.deepEqual(await pending, []);
      assert.equal(service.qrOutcomes.size, 0);
      assert.equal(fs.existsSync(service.file), false);
    },
  );
});
