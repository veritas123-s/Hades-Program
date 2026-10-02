import { decodeEntities } from "./news-text.mjs";

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
  for (const tag of html.matchAll(/<meta\b[^>]*>|<img\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map((x) => [
        x[1].toLowerCase(),
        x[2],
      ]),
    );
    const raw = /^<meta/i.test(tag[0])
      ? ["og:image", "twitter:image"].includes(attrs.property || attrs.name)
        ? attrs.content
        : ""
      : attrs["data-src"] || attrs["data-original"] || attrs.src;
    const url = newsImageURL(raw, base);
    if (url) return url;
  }
  return "";
}

export async function loadNewsThumbnail(url, nativeImage, fetcher = fetch) {
  const safe = newsImageURL(url);
  if (!safe || !nativeImage) return "";
  const response = await fetcher(safe, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(6000),
  });
  if (
    !response.ok ||
    !/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(
      response.headers.get("content-type") || "",
    )
  )
    return "";
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      return "";
    }
    chunks.push(Buffer.from(value));
  }
  const image = nativeImage.createFromBuffer(Buffer.concat(chunks));
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
