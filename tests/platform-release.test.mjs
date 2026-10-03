import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { releasePlatform, macMenuTemplate } from "../electron/platform.mjs";
import { releaseFilename, validateRelease } from "../src/releases.mjs";
import { helpPath, helpMarkdownPath } from "../electron/help.mjs";
import { Updates } from "../electron/updates.mjs";
import fs from "node:fs";
import os from "node:os";
import { commandKey } from "../src/platform/shortcuts.mjs";

test("各平台只下载对应架构的官方文件，拒绝架构替换和外部地址", () => {
  assert.equal(releasePlatform("win32", "x64"), "windows");
  assert.equal(releasePlatform("darwin", "arm64"), "macos_arm64");
  assert.equal(releasePlatform("darwin", "x64"), "macos_x64");
  assert.equal(releasePlatform("linux", "arm64"), null);
  assert.equal(commandKey("darwin"), "⌘");
  assert.equal(commandKey("win32"), "Ctrl");
  const release = {
    schema: 1,
    version: "6.1.0",
    publishedAt: "2026-01-01T00:00:00Z",
    title: "Medstack V6.1.0",
    notes: ["增加 macOS 安装包"],
    downloads: {},
  };
  for (const platform of ["windows", "android", "macos_x64", "macos_arm64"]) {
    release.downloads[platform] = {
      url: `https://github.com/veritas123-s/Medstack-Program/releases/download/v6.1.0/${releaseFilename("6.1.0", platform)}`,
      sha256: "a".repeat(64),
    };
  }
  assert.equal(Object.keys(validateRelease(release).downloads).length, 4);
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-platform-"),
  );
  try {
    let opened;
    const updates = new Updates({
      directory,
      version: "6.0.2",
      platform: "macos_arm64",
      open: (url) => {
        opened = url;
      },
    });
    updates.save({ ...updates.data, release });
    updates.download();
    assert.equal(opened, release.downloads.macos_arm64.url);
    const bad = structuredClone(release);
    bad.downloads.macos_arm64.url = release.downloads.macos_x64.url;
    assert.throws(() => validateRelease(bad), /校验/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("macOS 固定帮助路径位于 Contents，菜单保留编辑和退出角色", () => {
  const app = {
    isPackaged: true,
    getPath: () =>
      path.resolve("synthetic/Medstack.app/Contents/MacOS/Medstack"),
  };
  assert.equal(
    helpPath(app, "user", "darwin"),
    path.resolve(
      "synthetic/Medstack.app/Contents/Resources/帮助文档/USER-GUIDE.html",
    ),
  );
  assert.equal(
    helpMarkdownPath(app, "developer", "darwin"),
    path.resolve(
      "synthetic/Medstack.app/Contents/Resources/帮助文档/DEVELOPER-HANDBOOK.md",
    ),
  );
  let shown = 0,
    document;
  const menu = macMenuTemplate(
    "Medstack",
    () => shown++,
    (kind) => {
      document = kind;
    },
  );
  const roles = menu.flatMap((entry) => entry.submenu.map((item) => item.role));
  for (const role of [
    "quit",
    "hide",
    "services",
    "copy",
    "paste",
    "undo",
    "selectAll",
    "togglefullscreen",
  ])
    assert.ok(roles.includes(role));
  menu[3].submenu.find((item) => item.label === "打开工作台").click();
  menu[4].submenu[0].click();
  assert.equal(shown, 1);
  assert.equal(document, "user");
});
