// Read declared source encodings; never silently replace broken Chinese bytes.
export function decodeNews(buffer, contentType = "") {
  const head = buffer.subarray(0, 4096).toString("latin1");
  const declared =
    contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ||
    head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ||
    "utf-8";
  const aliases = {
    utf8: "utf-8",
    "utf-8": "utf-8",
    gbk: "gb18030",
    gb2312: "gb18030",
    gb18030: "gb18030",
    big5: "big5",
  };
  const encoding = aliases[declared.toLowerCase()];
  if (!encoding) throw Error("来源使用未支持的字符编码");
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw Error("来源字符编码异常，未保存乱码内容");
  }
}
export function decodeEntities(text) {
  const named = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    mdash: "—",
    ndash: "–",
    hellip: "…",
    middot: "·",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
  };
  return String(text).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (raw, key) => {
    if (!key.startsWith("#")) return named[key.toLowerCase()] ?? raw;
    const code =
      key[1].toLowerCase() === "x"
        ? parseInt(key.slice(2), 16)
        : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : raw;
  });
}
