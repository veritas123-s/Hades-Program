import { newsURL } from "./news-service.mjs";
export function openNewsReader(BrowserWindow, url) {
  const window = new BrowserWindow({
    width: 900,
    height: 900,
    title: "医栈通 · 组织原文",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: "medstack-public-article",
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      window.loadURL(newsURL(url)).catch(() => {});
    } catch {}
    return { action: "deny" };
  });
  for (const event of ["will-navigate", "will-redirect"])
    window.webContents.on(event, (e, url) => {
      try {
        newsURL(url);
      } catch {
        e.preventDefault();
      }
    });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.on("will-download", (event) =>
    event.preventDefault(),
  );
  window.loadURL(newsURL(url)).catch(() => {
    window.setTitle("医栈通 · 原文暂时无法载入");
  });
  return {
    close: () => {
      if (!window.isDestroyed()) window.close();
    },
  };
}
