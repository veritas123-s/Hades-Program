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
    // Many sites incorrectly declare GBK while serving UTF-8. Valid multibyte
    // UTF-8 is deterministic; legacy Chinese bytes normally fail this check.
    try {
      const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (encoding === "utf-8" || /[^\x00-\x7f]/.test(utf8))
        return repairNewsText(utf8);
    } catch {}
    return repairNewsText(
      new TextDecoder(encoding, { fatal: true }).decode(buffer),
    );
  } catch {
    throw Error("来源字符编码异常，未保存乱码内容");
  }
}
export function repairNewsText(raw) {
  let text = String(raw || "");
  // Repair only a reversible Latin-1 -> UTF-8 conversion, never guess Chinese.
  const windows1252 = new Map(
    [..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"].map((c, i) => [
      c,
      [
        128, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 142, 145,
        146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 158, 159,
      ][i],
    ]),
  );
  text = text.replace(/[\u0080-\u024f\u2010-\u2122]{2,}/g, (part) => {
    try {
      const codes = [...part].map((x) => windows1252.get(x) ?? x.charCodeAt(0));
      if (codes.some((x) => x > 255)) return part;
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(codes),
      );
      return /[\u3400-\u9fff]/.test(decoded) ? decoded : part;
    } catch {
      return part;
    }
  });
  return text
    .replace(/\\u([\da-f]{4})/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/\\x([\da-f]{2})/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/\\\//g, "/")
    .replace(/[\u200b-\u200d\ufeff]/g, "");
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
