import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { launchAuthenticated } from "./account-test-fixture.mjs";
const env = {
  ...process.env,
  VERITAS_TEST: "1",
  VERITAS_TEST_DATA: fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-update-install-ui-"),
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await launchAuthenticated({
  executablePath: path.resolve(process.argv[2]),
  args: [],
  env,
});
try {
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  await app.evaluate(({ net }) => {
    const original = net.fetch.bind(net);
    net.fetch = async (url, options) =>
      new URL(url).pathname === "/api/releases/latest"
        ? Response.json({
            schema: 1,
            version: "6.0.3",
            publishedAt: "2026-01-01T00:00:00Z",
            title: "合成更新",
            notes: ["不安装，只验证拒绝错误哈希"],
            downloads: {
              windows: {
                url: "https://github.com/veritas123-s/Medstack-Program/releases/download/v6.0.3/Medstack-Setup-6.0.3-x64.exe",
                sha256: "0".repeat(64),
              },
            },
          })
        : original(url, options);
    const originalFetch = global.fetch;
    global.fetch = async (url, options) =>
      String(url).includes("/releases/download/v6.0.3/")
        ? new Response(new Uint8Array(150000))
        : originalFetch(url, options);
  });
  await page.evaluate(() => window.veritas.call("updates.check"));
  const banner = page.getByRole("region", { name: "版本更新" });
  await page
    .getByRole("button", { name: "一键更新", exact: true })
    .first()
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "安装包校验失败" })
    .first()
    .waitFor();
  const status = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(status.updates.installation.phase, "error");
  assert.equal(status.account.authenticated, true);
  await page.screenshot({ path: "test-results/update-install-validation.png" });
  fs.writeFileSync(
    "test-results/update-install-ui.json",
    JSON.stringify(
      {
        passed: true,
        synthetic: true,
        packaged: true,
        wrongHashRejected: true,
        appRemainedOpen: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS packaged one-click update, progress/error UI, wrong hash prevented exit/install",
  );
} finally {
  await app.close();
}
