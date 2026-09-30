import path from "node:path";
import fs from "node:fs/promises";

// Public, bundled documentation only. Never accept a path or URL from the renderer.
export function helpPath(app, kind) {
  const names = {
    user: "USER-GUIDE.html",
    developer: "DEVELOPER-HANDBOOK.html",
  };
  if (!Object.hasOwn(names, kind)) throw Error("未知帮助文档");
  const directory = app.isPackaged
    ? path.join(path.dirname(app.getPath("exe")), "帮助文档")
    : path.join(app.getAppPath(), "docs", "offline");
  return path.join(directory, names[kind]);
}

export async function openHelp(app, shell, kind) {
  const error = await shell.openPath(helpPath(app, kind));
  if (error) throw Error("文档未能打开，请在安装目录的“帮助文档”中查看");
  return { ok: true };
}

export function helpMarkdownPath(app, kind) {
  const names = { user: "USER-GUIDE.md", developer: "DEVELOPER-HANDBOOK.md" };
  if (!Object.hasOwn(names, kind)) throw Error("未知帮助文档");
  const directory = app.isPackaged
    ? path.join(path.dirname(app.getPath("exe")), "帮助文档")
    : path.join(app.getAppPath(), "docs");
  return path.join(directory, names[kind]);
}

export async function readHelp(app, kind) {
  const text = await fs.readFile(helpMarkdownPath(app, kind), "utf8");
  if (text.length > 512 * 1024) throw Error("帮助文档过大");
  return { kind, text };
}
