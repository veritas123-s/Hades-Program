import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { helpPath, openHelp } from "../electron/help.mjs";
import { requireAccount } from "../electron/accounts/access.mjs";

test("公开帮助仅能打开随包固定文档，不能访问个人目录或任意网址", async () => {
  const app = { isPackaged: true, getPath: () => path.resolve("synthetic/Hades.exe") };
  requireAccount(null, "help.open");
  assert.throws(() => requireAccount(null, "data.folder"), /登录/);
  for (const invalid of ["../account-vault.bin", "https://example.com", "constructor", "__proto__", undefined])
    assert.throws(() => helpPath(app, invalid), /未知/);
  let opened;
  await openHelp(app, { openPath: async p => { opened = p; return ""; } }, "user");
  assert.equal(opened, path.resolve("synthetic/帮助文档/USER-GUIDE.html"));
  await assert.rejects(openHelp(app, { openPath: async () => "missing" }, "developer"), /未能打开/);
});
