import { decodeEntities, repairNewsText } from "./news-text.mjs";
export function tagAttributes(tag) {
  return Object.fromEntries(
    [...String(tag).matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((x) => [
      x[1].toLowerCase(),
      decodeEntities(repairNewsText(x[3])),
    ]),
  );
}
export function metadata(html, key) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = tagAttributes(tag[0]);
    if ((a.property || a.name || "").toLowerCase() === key)
      return a.content || "";
  }
  return "";
}
export function articleLinks(html, base) {
  const links = new Set();
  for (const tag of html.matchAll(/<a\b[^>]*>/gi)) {
    const a = tagAttributes(tag[0]);
    try {
      const u = new URL(a.href, base);
      if (u.protocol !== "https:" || u.username || u.password || u.port)
        continue;
      if (
        (u.hostname === "mp.weixin.qq.com" &&
          /^\/s(?:\/|$)/.test(u.pathname)) ||
        (u.hostname === "www.shsmu.edu.cn" &&
          /^\/news\/info\/\d+\/\d+\.htm$/.test(u.pathname))
      )
        links.add(u.href);
    } catch {}
  }
  return [...links];
}
export function articleBody(raw) {
  const html = raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const opening of html.matchAll(/<div\b[^>]*>/gi)) {
    const id = tagAttributes(opening[0]).id || "";
    if (id !== "js_content" && !/^vsb_content(?:_\d+)?$/.test(id)) continue;
    const start = opening.index + opening[0].length;
    let depth = 1;
    for (const tag of html.slice(start).matchAll(/<div\b[^>]*>|<\/div\s*>/gi)) {
      depth += /^<\//.test(tag[0]) ? -1 : 1;
      if (depth === 0) return html.slice(start, start + tag.index);
    }
    return "";
  }
  return "";
}
