import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const env = {
  ...process.env,
  VERITAS_TEST: "1",
  VERITAS_TEST_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "veritas-package-")),
};
delete env.ELECTRON_RUN_AS_NODE;
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const executablePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(
      pkg.build.directories.output,
      "win-unpacked",
      pkg.build.productName + ".exe",
    );
const app = await electron.launch({ executablePath, args: [], env });
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(
    (await page.evaluate(() => window.veritas.call("state"))).schemaVersion,
    5,
  );
  const initial = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(initial.tasks.length, 0);
  assert.equal(initial.logs.length, 0);
  assert.equal(initial.courses.length, 0);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 820),
  );
  await page.getByRole("button", { name: "四象限", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "test-results/04-packaged-matrix.png" });
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1400, 920),
  );
  await page.screenshot({
    path: "test-results/05-packaged-overview.png",
    fullPage: true,
  });
  const info = await app.evaluate(({ app }) => ({
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
  }));
  assert.equal(info.version, pkg.version);
  const assistant = await page.evaluate(() =>
    window.veritas.call("assistant.state"),
  );
  assert.equal(assistant.configured, false);
  const bridge = await page.evaluate(() =>
    window.veritas.call("briefing.state"),
  );
  assert.equal(bridge.sync.configured, false);
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page.getByLabel("API 密钥").waitFor();
  await page.getByRole("button", { name: "关闭 AI 助手", exact: true }).click();
  await page.getByRole("button", { name: "更换主题", exact: true }).click();
  await page
    .getByRole("button", { name: "使用午夜星图主题", exact: true })
    .click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "midnight",
  );
  await page.getByRole("button", { name: "添加随手记", exact: true }).click();
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  await page.getByLabel("随手记内容").fill("发行包合成验证");
  await page.getByRole("button", { name: "保存便笺", exact: true }).click();
  await page.getByRole("button", { name: "已保存", exact: true }).waitFor();
  assert.equal(
    (await page.evaluate(() => window.veritas.call("state"))).workspace
      .widgetData["quick-note"].data.text,
    "发行包合成验证",
  );
  await page.screenshot({
    path: "test-results/v13-packaged-midnight.png",
    fullPage: true,
  });
  fs.writeFileSync(
    "test-results/package-smoke.json",
    JSON.stringify(
      {
        passed: true,
        ...info,
        checks: [
          "Packaged application starts",
          "IPC and storage initialize",
          "1100px layout has no horizontal overflow",
          "Theme switching and optional widget persistence work in packaged app",
          "Assistant and cloud services initialize without bundled user credentials",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS packaged Windows application", info);
} finally {
  await app.close();
}
