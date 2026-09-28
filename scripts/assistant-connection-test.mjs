import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-own-api-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2];
const errors = [];
let app, page;
async function start() {
  app = await electron.launch({
    ...(executablePath
      ? { executablePath, args: [] }
      : { args: [process.cwd()] }),
    env,
  });
  page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  await app.evaluate(({ net }) => {
    globalThis.connectionRequests = [];
    net.fetch = async (url, options) => {
      if (!url.startsWith("https://custom.example/v1/"))
        throw new Error("Unexpected external request in isolated test");
      globalThis.connectionRequests.push({
        url,
        model: options.body ? JSON.parse(options.body).model : null,
        usesOwnKey:
          options.headers.Authorization === "Bearer synthetic-classmate-api",
      });
      if (url.endsWith("/models"))
        return new Response("No model list", { status: 404 });
      return Response.json({
        choices: [
          { message: { content: '{"reply":"自定义连接验证成功","tasks":[]}' } },
        ],
      });
    };
  });
}
try {
  await start();
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page
    .getByLabel("API 地址", { exact: true })
    .fill("https://custom.example/v1/");
  await page
    .getByLabel("API 密钥", { exact: true })
    .fill("synthetic-classmate-api");
  await page
    .getByLabel("模型调用名", { exact: true })
    .fill("org/custom-model:free");
  await page
    .getByRole("button", { name: "保存并检查连接", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "手动填写" }).waitFor();
  const configured = await page.evaluate(() =>
    window.veritas.call("assistant.state"),
  );
  assert.equal(configured.endpoint, "https://custom.example/v1");
  assert.equal(configured.model, "org/custom-model:free");
  assert.equal(
    await page.getByLabel("API 密钥", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("对助手说").fill("只回复合成验证文字");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByText("自定义连接验证成功", { exact: true }).waitFor();
  const requests = await app.evaluate(() => globalThis.connectionRequests);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => r.usesOwnKey));
  assert.equal(requests[1].model, "org/custom-model:free");
  await page
    .getByLabel("API 地址", { exact: true })
    .fill("https://another.example/v1");
  await page
    .getByRole("button", { name: "保存并检查连接", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "该服务自己的密钥" })
    .waitFor();
  assert.equal(
    (await page.evaluate(() => window.veritas.call("assistant.state")))
      .endpoint,
    "https://custom.example/v1",
  );
  assert.equal(
    fs
      .readFileSync(path.join(directory, "assistant-vault.bin"))
      .includes(Buffer.from("synthetic-classmate-api")),
    false,
  );
  await app.close();
  await start();
  const restored = await page.evaluate(() =>
    window.veritas.call("assistant.state"),
  );
  assert.equal(restored.configured, true);
  assert.equal(restored.endpoint, "https://custom.example/v1");
  assert.equal(restored.model, "org/custom-model:free");
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page.getByRole("button", { name: "助手连接设置", exact: true }).click();
  assert.equal(
    await page.getByLabel("API 地址", { exact: true }).inputValue(),
    restored.endpoint,
  );
  await page.screenshot({ path: "test-results/v131-own-api.png" });
  await page.getByRole("button", { name: "移除本机密钥", exact: true }).click();
  await page.waitForFunction(
    async () => !(await window.veritas.call("assistant.state")).configured,
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/assistant-connection-desktop.json",
    JSON.stringify(
      {
        passed: true,
        customEndpoint: true,
        manualModelWithoutList: true,
        providerChangeProtectsOldKey: true,
        encryptedPersistence: true,
        restart: true,
        forget: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS packaged custom API, own key, manual model, encrypted restart and key removal",
  );
} finally {
  await app?.close();
}
