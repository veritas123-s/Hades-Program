import { Worker } from "node:worker_threads";
import { publicResponse, boundedBytes } from "./public-fetch.mjs";
import { newsImageURL } from "./news-images.mjs";
import { imageDimensions } from "./image-dimensions.mjs";
import { articleLinks } from "./news-markup.mjs";
import { decodeNews } from "./news-text.mjs";

// Backend catalog: add only QR images whose account attribution was checked.
// The school's homepage labels this image as its official WeChat account.
export const WECHAT_QR_ENTRIES = Object.freeze({
  上海交通大学医学院: Object.freeze({
    imageURL: "https://www.shsmu.edu.cn/images/weixin.jpg",
    provenance: "https://www.shsmu.edu.cn/",
  }),
});

export function wechatEntryURL(raw) {
  const url = new URL(String(raw));
  if (
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw Error("公众号入口无效");
  if (
    url.hostname === "weixin.qq.com" &&
    /^\/r\/[\w-]+\/?$/.test(url.pathname)
  ) {
    // Older official QR images contain HTTP. Never request that insecure URL.
    url.protocol = "https:";
  } else if (
    url.protocol !== "https:" ||
    url.hostname !== "mp.weixin.qq.com" ||
    !(
      /^\/s(?:\/[^/]+)?$/.test(url.pathname) ||
      (url.pathname === "/mp/profile_ext" &&
        url.searchParams.get("action") === "home")
    )
  )
    throw Error("公众号入口不受支持");
  return url.href;
}

export function qrPixels(buffer, nativeImage) {
  const size = imageDimensions(buffer);
  if (!size || size.some((x) => x < 32) || size[0] * size[1] > 4000000)
    throw Error("二维码图片尺寸无效");
  if (!nativeImage) throw Error("二维码解码器不可用");
  let image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) throw Error("二维码图片无法读取");
  let { width, height } = image.getSize();
  if (width * height > 4000000) throw Error("二维码图片尺寸无效");
  const ratio = Math.min(1, 1024 / Math.max(width, height));
  if (ratio < 1) {
    image = image.resize({
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    });
    ({ width, height } = image.getSize());
  }
  const bitmap = image.toBitmap();
  if (bitmap.length !== width * height * 4) throw Error("二维码像素格式无效");
  const pixels = new Uint8ClampedArray(bitmap.length);
  // Windows nativeImage returns premultiplied BGRA. Composite onto white.
  for (let i = 0; i < bitmap.length; i += 4) {
    const white = 255 - bitmap[i + 3];
    pixels[i] = Math.min(255, bitmap[i + 2] + white);
    pixels[i + 1] = Math.min(255, bitmap[i + 1] + white);
    pixels[i + 2] = Math.min(255, bitmap[i] + white);
    pixels[i + 3] = 255;
  }
  return { pixels: pixels.buffer, width, height };
}

export async function decodeWechatQR(buffer, nativeImage, signal) {
  signal?.throwIfAborted();
  const data = qrPixels(buffer, nativeImage);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./news-qr-worker.mjs", import.meta.url),
      {
        workerData: data,
        transferList: [data.pixels],
      },
    );
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () => finish(signal.reason || Error("二维码识别已取消"));
    const timer = setTimeout(() => finish(Error("二维码识别超时")), 5000);
    worker.once("message", (value) => {
      try {
        finish(null, wechatEntryURL(value));
      } catch {
        finish(Error("二维码未识别到有效公众号入口"));
      }
    });
    worker.once("error", (error) => finish(error));
    worker.once("exit", () => finish(Error("二维码识别未完成")));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function inspectWechatQR({
  entry,
  nativeImage,
  fetcher = fetch,
  signal,
  decoder = decodeWechatQR,
}) {
  const activeSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(18000),
  ]);
  const imageURL = newsImageURL(entry.imageURL);
  if (!imageURL) throw Error("二维码图片来源不受信任");
  const image = await publicResponse(imageURL, {
    validate: (raw) => {
      const safe = newsImageURL(raw);
      if (!safe) throw Error("二维码图片来源不受信任");
      return safe;
    },
    fetcher,
    signal: activeSignal,
  });
  if (
    !/^image\/(?:png|jpeg)(?:;|$)/i.test(
      image.headers.get("content-type") || "",
    )
  )
    throw Error("二维码图片格式无效");
  const buffer = await boundedBytes(image, 2 * 1024 * 1024, activeSignal);
  const url = wechatEntryURL(await decoder(buffer, nativeImage, activeSignal));
  const response = await publicResponse(url, {
    validate: wechatEntryURL,
    fetcher,
    signal: activeSignal,
    headers: { Accept: "text/html", "User-Agent": "Medstack-PublicNews/5.3" },
  });
  const html = decodeNews(
    await boundedBytes(response, 2 * 1024 * 1024, activeSignal),
    response.headers.get("content-type") || "",
  );
  if (/环境异常|请输入验证码|访问过于频繁|安全验证|antispider/i.test(html))
    return { status: "verification", urls: [] };
  // Do not execute scripts, follow app-download links, or launch the WeChat client.
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const urls = articleLinks(markup, url).filter(
    (raw) => new URL(raw).hostname === "mp.weixin.qq.com",
  );
  if (
    new URL(url).hostname === "mp.weixin.qq.com" &&
    /^\/s(?:\/|$)/.test(new URL(url).pathname)
  )
    urls.unshift(url);
  return {
    status: urls.length ? "public-links" : "client-required",
    urls: [...new Set(urls)].slice(0, 12),
  };
}
