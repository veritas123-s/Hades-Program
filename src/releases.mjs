export const RELEASE_FEED =
  "https://raw.githubusercontent.com/veritas123-s/Medstack-Program/main/releases/stable.json";
export function versionParts(value) {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)
  )
    throw Error("版本号无效");
  return value.split(".").map(Number);
}
export function newerVersion(candidate, installed) {
  const a = versionParts(candidate),
    b = versionParts(installed);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export function validateRelease(input) {
  if (!input || input.schema !== 1) throw Error("更新公告格式无效");
  versionParts(input.version);
  if (
    typeof input.publishedAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT/.test(input.publishedAt) ||
    !Number.isFinite(Date.parse(input.publishedAt))
  )
    throw Error("发布日期无效");
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 100
  )
    throw Error("公告标题无效");
  if (
    !Array.isArray(input.notes) ||
    !input.notes.length ||
    input.notes.length > 20 ||
    input.notes.some(
      (n) => typeof n !== "string" || !n.trim() || n.length > 300,
    )
  )
    throw Error("更新内容无效");
  const downloads = {};
  for (const platform of ["windows", "android"]) {
    const item = input.downloads?.[platform];
    if (!item) continue;
    const filename =
      platform === "windows"
        ? `Medstack-Setup-${input.version}-x64.exe`
        : `Medstack-${input.version}-Android.apk`;
    const expected = `https://github.com/veritas123-s/Medstack-Program/releases/download/v${input.version}/${filename}`;
    if (item.url !== expected || !/^[a-f0-9]{64}$/.test(item.sha256 || ""))
      throw Error("下载地址或校验值无效");
    downloads[platform] = { url: item.url, sha256: item.sha256 };
  }
  if (!Object.keys(downloads).length) throw Error("公告缺少安装包");
  return {
    schema: 1,
    version: input.version,
    publishedAt: input.publishedAt,
    title: input.title.trim(),
    notes: input.notes.map((n) => n.trim()),
    urgent: input.urgent === true,
    downloads,
  };
}
