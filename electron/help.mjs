import path from "node:path";

// Public, bundled documentation only. Never accept a path or URL from the renderer.
export function helpPath(app, kind) {
  const names = { user: "USER-GUIDE.html", developer: "DEVELOPER-HANDBOOK.html" };
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
