import { decodeEntities } from "./news-text.mjs";
import { tagAttributes, metadata } from "./news-markup.mjs";
import { publicResponse, boundedBytes } from "./public-fetch.mjs";
import { imageDimensions } from "./image-dimensions.mjs";

const hosts = new Set([
  "news.sjtu.edu.cn",
  "www.shsmu.edu.cn",
  "mmbiz.qpic.cn",
  "mmbiz.qlogo.cn",
  "img01.sogoucdn.com",
  "img02.sogoucdn.com",
  "img03.sogoucdn.com",
  "img04.sogoucdn.com",
]);
export function newsImageURL(raw, base) {
  try {
    if (!String(raw || "").trim()) return "";
    const url = new URL(decodeEntities(String(raw || "")), base);
    if (
      url.protocol !== "https:" ||
      !hosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}
export function articleCover(html, base) {
  const candidates = [
    metadata(html, "og:image"),
    metadata(html, "twitter:image"),
    html.match(/(?:var\s+)?msg_cdn_url\s*=\s*["']([^"']+)["']/)?.[1],
  ];
  for (const raw of candidates) {
    const url = newsImageURL(raw?.replace(/^http:\/\//i, "https://"), base);
    if (url) return url;
  }
  for (const tag of html.matchAll(/<meta\b[^>]*>|<img\b[^>]*>/gi)) {
    const attrs = tagAttributes(tag[0]);
    const raw = /^<meta/i.test(tag[0])
      ? ["og:image", "twitter:image"].includes(attrs.property || attrs.name)
        ? attrs.content
        : ""
      : attrs["data-src"] || attrs["data-original"] || attrs.src;
    const url = newsImageURL(raw?.replace(/^http:\/\//i, "https://"), base);
    if (url) return url;
  }
  return "";
}

export async function loadNewsThumbnail(url, nativeImage, fetcher = fetch) {
  const safe = newsImageURL(url);
  if (!safe || !nativeImage) return "";
  const signal = AbortSignal.timeout(12000);
  const response = await publicResponse(safe, {
    validate: (raw) => {
      const u = newsImageURL(raw);
      if (!u) throw Error("图片来源不受信任");
      return u;
    },
    fetcher,
    signal,
    headers: {
      Referer: new URL(safe).hostname.startsWith("mmbiz.")
        ? "https://mp.weixin.qq.com/"
        : "https://news.sjtu.edu.cn/",
    },
  });
  if (
    !response.ok ||
    !/^image\/(?:jpeg|png|webp|gif)(?:;|$)/i.test(
      response.headers.get("content-type") || "",
    )
  )
    return "";
  let buffer;
  try {
    buffer = await boundedBytes(response, 2 * 1024 * 1024, signal);
  } catch {
    return "";
  }
  const size = imageDimensions(buffer);
  if (!size || size.some((x) => x < 32) || size[0] * size[1] > 24000000)
    return "";
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) return "";
  const dimensions = image.getSize();
  if (
    dimensions.width < 32 ||
    dimensions.height < 32 ||
    dimensions.width * dimensions.height > 24000000
  )
    return "";
  const resized = dimensions.width > 480 ? image.resize({ width: 480 }) : image;
  const bytes = resized.toJPEG(75);
  return bytes.length <= 180000
    ? `data:image/jpeg;base64,${bytes.toString("base64")}`
    : "";
}
