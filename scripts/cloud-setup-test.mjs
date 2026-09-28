import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "veritas-cloud-setup-"),
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2];
let app, page;
const errors = [];
async function start() {
  app = await launchAuthenticated({
    ...(executablePath
      ? { executablePath, args: [] }
      : { args: [process.cwd()] }),
    env,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  await app.evaluate(async ({ net, shell }, fixture) => {
    const { fakeCloud } = process
      .getBuiltinModule("module")
      .createRequire(fixture)(fixture);
    globalThis.testCloud = fakeCloud();
    net.fetch = globalThis.testCloud.fetcher;
    shell.openExternal = async (url) => {
      globalThis.cloudOpenedURL = url;
    };
  }, path.resolve("tests/fixtures/cloud-provider.mjs"));
  await page.getByRole("button", { name: "快报与提醒", exact: true }).click();
  await page.getByRole("button", { name: "扫码开通自己的微信早晚报" }).click();
}
try {
  await start();
  let data = await page.evaluate(() =>
    window.veritas.call("briefing.cloud.state"),
  );
  assert.equal(data.plan, null);
  assert.equal(data.login.authenticated, false);
  assert.equal(data.pushConfigured, false);
  assert.equal(
    await page
      .getByRole("button", { name: "确认并开通我的云提醒" })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "扫码登录腾讯云", exact: true })
    .click();
  await page.getByRole("button", { name: "取消登录", exact: true }).waitFor();
  const auth = new URL(await app.evaluate(() => globalThis.cloudOpenedURL));
  assert.equal(auth.origin, "https://cloud.tencent.com");
  const target = new URL(
    new URL(auth.searchParams.get("redirect_url")).searchParams.get(
      "redirect_url",
    ),
  );
  target.hostname = "127.0.0.1";
  target.search = new URLSearchParams({
    access_token: "synthetic-oauth-access",
    state: auth.searchParams.get("state"),
    site: "cn",
  });
  assert.equal((await fetch(target)).status, 200);
  await page
    .getByRole("button", { name: "退出本次授权", exact: true })
    .waitFor();
  await page
    .getByLabel("我的 pushplus Token")
    .fill("syntheticClassmatePush0123456789");
  await page
    .getByRole("button", { name: "保存微信接收配置", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /我确认使用自己的腾讯云/ }).check();
  await page
    .getByRole("button", { name: "确认并开通我的云提醒", exact: true })
    .click();
  await page
    .getByRole("button", { name: "发送一条测试提醒", exact: true })
    .waitFor({ timeout: 30_000 });
  data = await page.evaluate(() => window.veritas.call("briefing.cloud.state"));
  assert.equal(data.phase, "ready", data.message);
  assert.equal(data.receivedAt, null);
  assert.doesNotMatch(
    JSON.stringify(data),
    /syntheticClassmatePush|synthetic-cloud-secret|synthetic-oauth-access/,
  );
  assert.equal(
    await app.evaluate(() => globalThis.testCloud.state.testCount),
    0,
  );
  await page
    .getByRole("button", { name: "发送一条测试提醒", exact: true })
    .click();
  await page.getByText(/推送服务已受理/).waitFor();
  await page.getByRole("button", { name: "微信已收到", exact: true }).click();
  await page.getByText(/本人确认测试送达/).waitFor();
  const screenshot = path.resolve("test-results/v131-cloud-setup.png");
  await page.screenshot({ path: "test-results/v131-cloud-verified.png" });
  await page
    .getByRole("button", { name: "重新登录腾讯云", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot });
  assert.equal(
    await page
      .locator(".cloud-setup-body")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    true,
  );
  const vault = fs.readFileSync(
    path.join(fixtureProfile(directory), "cloud-setup-vault.bin"),
  );
  assert.ok(!vault.includes(Buffer.from("syntheticClassmatePush")));
  assert.ok(!vault.includes(Buffer.from("synthetic-cloud-secret")));
  await app.close();
  app = null;
  await start();
  data = await page.evaluate(() => window.veritas.call("briefing.cloud.state"));
  assert.ok(data.plan.completedAt);
  assert.ok(data.receivedAt);
  assert.equal(data.pushConfigured, true);
  assert.equal(data.login.authenticated, false);
  assert.deepEqual(errors, []);
  const report = {
    passed: true,
    isolated: true,
    provider: "synthetic, no real cloud resources or messages",
    freshInstall: true,
    callbackVerified: true,
    consentGated: true,
    deploymentAndDigestVerified: true,
    encryptedConfig: true,
    restartWithoutCloudCredentials: true,
    screenshot,
    checkedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    "test-results/cloud-setup-desktop.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (app) await app.close();
}
