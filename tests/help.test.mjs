import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  helpMarkdownPath,
  helpPath,
  openHelp,
  readHelp,
} from "../electron/help.mjs";
import { requireAccount } from "../electron/accounts/access.mjs";

test("公开帮助仅能打开随包固定文档，不能访问个人目录或任意网址", async () => {
  const app = {
    isPackaged: true,
    getPath: () =>
      path.resolve(
        process.platform === "darwin"
          ? "synthetic/Medstack.app/Contents/MacOS/Medstack"
          : "synthetic/Medstack.exe",
      ),
  };
  requireAccount(null, "help.open");
  requireAccount(null, "help.read");
  assert.throws(() => requireAccount(null, "data.folder"), /登录/);
  for (const invalid of [
    "../account-vault.bin",
    "https://example.com",
    "constructor",
    "__proto__",
    undefined,
  ])
    assert.throws(() => helpPath(app, invalid), /未知/);
  for (const invalid of ["../data.json", "file:///secret", "prototype"])
    assert.throws(() => helpMarkdownPath(app, invalid), /未知/);
  let opened;
  await openHelp(
    app,
    {
      openPath: async (p) => {
        opened = p;
        return "";
      },
    },
    "user",
  );
  assert.equal(
    opened,
    path.resolve(
      process.platform === "darwin"
        ? "synthetic/Medstack.app/Contents/帮助文档/USER-GUIDE.html"
        : "synthetic/帮助文档/USER-GUIDE.html",
    ),
  );
  await assert.rejects(
    openHelp(app, { openPath: async () => "missing" }, "developer"),
    /未能打开/,
  );
});

test("应用内手册只读取固定 Markdown 文件并限制大小", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "medstack-help-"));
  const docs = path.join(root, "docs");
  await fs.mkdir(docs);
  await fs.writeFile(
    path.join(docs, "USER-GUIDE.md"),
    "# 合成使用说明",
    "utf8",
  );
  await fs.writeFile(
    path.join(docs, "DEVELOPER-HANDBOOK.md"),
    "# 合成开发手册",
    "utf8",
  );
  const app = { isPackaged: false, getAppPath: () => root };
  assert.equal((await readHelp(app, "user")).text, "# 合成使用说明");
  assert.equal(
    path.basename(helpMarkdownPath(app, "developer")),
    "DEVELOPER-HANDBOOK.md",
  );
  await fs.rm(root, { recursive: true, force: true });
});
