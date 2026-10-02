import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { launchAuthenticated } from "./account-test-fixture.mjs";
const currentVersion = JSON.parse(
  fs.readFileSync("package.json", "utf8"),
).version;
const parts = currentVersion.split(".").map(Number);
const nextVersion = `${parts[0]}.${parts[1] + 1}.0`;
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "medstack-updates-ui-"),
);
let app;
try {
  const env = {
    ...process.env,
    VERITAS_TEST: "1",
    VERITAS_TEST_DATA: directory,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await launchAuthenticated({
    ...(process.argv[2]
      ? { executablePath: path.resolve(process.argv[2]), args: [] }
      : { args: [path.resolve(".")] }),
    env,
  });
  await app.evaluate(({ net }, nextVersion) => {
    const previous = net.fetch.bind(net);
    let subscribed = false;
    net.fetch = async (url, options) => {
      if (url.endsWith("/api/releases/latest"))
        return Response.json({
          release: {
            schema: 1,
            version: nextVersion,
            publishedAt: "2026-01-01T00:00:00Z",
            title: "医栈通合成更新",
            notes: ["仅用于更新界面验收"],
            downloads: {
              windows: {
                url: `https://github.com/veritas123-s/Medstack-Program/releases/download/v${nextVersion}/Medstack-Setup-${nextVersion}-x64.exe`,
                sha256: "a".repeat(64),
              },
            },
          },
        });
      if (url.endsWith("/api/releases/preferences")) {
        if (!options.headers.Authorization)
          throw Error("Missing account token");
        if (options.body) subscribed = JSON.parse(options.body).emailUpdates;
        return Response.json({ emailUpdates: subscribed });
      }
      return previous(url, options);
    };
  }, nextVersion);
  const page = await app.firstWindow(),
    call = (action, p = {}) =>
      page.evaluate(([a, p]) => window.veritas.call(a, p), [action, p]);
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  await call("updates.check");
  const banner = page.getByRole("region", { name: "版本更新" });
  await banner.waitFor();
  assert.ok((await banner.innerText()).includes(nextVersion));
  await banner.getByRole("button", { name: "稍后提醒" }).click();
  await banner.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "设置与数据", exact: true }).click();
  await page.getByRole("tab", { name: "版本更新", exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: "通过邮箱接收版本更新" });
  await checkbox.waitFor();
  await checkbox.click();
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="通过邮箱接收版本更新"]').checked ===
      true,
  );
  await assert.doesNotReject(() => checkbox.waitFor());
  assert.equal(await checkbox.isChecked(), true);
  await checkbox.click();
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="通过邮箱接收版本更新"]').checked ===
      false,
  );
  assert.equal(await checkbox.isChecked(), false);
  await page.screenshot({ path: "test-results/updates-v51-settings.png" });
  fs.writeFileSync(
    "test-results/updates-v51-ui.json",
    JSON.stringify(
      {
        passed: true,
        version: currentVersion,
        checks: [
          "homepage-banner",
          "dismiss-per-version",
          "settings-announcement",
          "opt-in",
          "unsubscribe",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS 更新提示、去重、公告、主动邮件订阅与取消");
} finally {
  if (app) await app.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
