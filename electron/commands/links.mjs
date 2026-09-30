import { isIP } from "node:net";
export function publicLink(raw) {
  if (typeof raw !== "string" || raw.length > 4000) throw Error("链接无效");
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    isIP(u.hostname) ||
    !u.hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal)$/i.test(u.hostname)
  )
    throw Error("仅打开公开 HTTPS 网页");
  return u.href;
}
export default async function execute(_action, p, { shell }) {
  await shell.openExternal(publicLink(p.url));
  return { ok: true };
}
