const fs = require("node:fs");
const path = require("node:path");
function isRedirectedProfile(logical, physical) {
  const normal = (value) => value.replaceAll("/", "\\").toLowerCase();
  const redirected =
    /\\packages\\[^\\]+\\localcache\\(?:roaming|local)(?:\\|$)/;
  return redirected.test(normal(physical)) && !redirected.test(normal(logical));
}
function assertDesktopProfile(directory) {
  fs.mkdirSync(directory, { recursive: true });
  // MSIX can merge a real directory with redirected files. Resolve a file,
  // not just its parent; a directory-only check can falsely pass.
  const dataFile = path.join(directory, "veritas-data.json");
  let physical;
  if (fs.existsSync(dataFile))
    physical = path.dirname(fs.realpathSync.native(dataFile));
  else {
    const probe = path.join(
      directory,
      `.profile-probe-${process.pid}-${Date.now()}`,
    );
    fs.writeFileSync(probe, "", { flag: "wx" });
    try {
      physical = path.dirname(fs.realpathSync.native(probe));
    } finally {
      fs.unlinkSync(probe);
    }
  }
  if (isRedirectedProfile(directory, physical)) {
    const error = new Error(
      "当前启动环境使用了隔离数据目录。为保护日常记录，已停止加载；请从桌面快捷方式启动 Hades。",
    );
    error.code = "APPDATA_REDIRECTED";
    throw error;
  }
  return physical;
}
module.exports = { isRedirectedProfile, assertDesktopProfile };
