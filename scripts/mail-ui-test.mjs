import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchAuthenticated } from "./account-test-fixture.mjs";
const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-mail-ui-"));
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const options = process.argv[2]
  ? {
      executablePath: path.resolve(process.argv[2]),
      args: process.argv[3] === "--source" ? [root] : [],
      env,
    }
  : { args: [root], env };
let app;
const checks = [];
try {
  app = await launchAuthenticated(options);
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  await app.evaluate(
    async ({ app }, modulePath) => {
      modulePath = process.mainModule
        .require("node:path")
        .join(app.getAppPath(), "electron/mail-service.mjs");
      const { pathToFileURL } = process.mainModule.require("node:url");
      const vm = process.mainModule.require("node:vm");
      const { MailService } = await vm.runInThisContext(
        `import(${JSON.stringify(pathToFileURL(modulePath).href)})`,
        {
          importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
        },
      );
      // Only this isolated test process replaces network sessions. No test path in product.
      MailService.prototype.session = async function (operation) {
        const source = Buffer.from(
          "From: campus@example.invalid\r\nSubject: Synthetic\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n合成正文 <script>window.mailUnsafe=true</script>",
        );
        return operation({
          mailbox: { exists: 2, uidValidity: 123n, readOnly: true },
          status: async () => ({ unseen: 1 }),
          async *fetch() {
            yield {
              uid: 2,
              envelope: {
                subject: "合成通知：实验室安排",
                from: [{ name: "合成教务" }],
                date: new Date(0),
              },
              flags: new Set(),
              size: source.length,
            };
            yield {
              uid: 1,
              envelope: {
                subject: "合成已读通知",
                from: [{ name: "合成校园" }],
                date: new Date(0),
              },
              flags: new Set(["\\Seen"]),
              size: source.length,
            };
          },
          fetchOne: async (_, query) =>
            query.source ? { source } : { size: source.length },
        });
      };
    },
    process.argv[2] && process.argv[3] !== "--source"
      ? path.join(
          path.dirname(path.resolve(process.argv[2])),
          "resources/app.asar/electron/mail-service.mjs",
        )
      : path.join(root, "electron/mail-service.mjs"),
  );
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "交大邮箱", exact: true })
    .click();
  await page.getByLabel("jAccount 用户名").fill("synthetic");
  await page
    .getByLabel("邮箱密码", { exact: true })
    .fill("synthetic-ui-mail-secret");
  await page.getByRole("button", { name: "连接邮箱", exact: true }).click();
  await page
    .getByText("synthetic@sjtu.edu.cn · 未读 1 / 共 2", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".mail-row").count(), 2);
  checks.push("连接与收件箱计数");
  await page.getByLabel("只看未读").check();
  assert.equal(await page.locator(".mail-row").count(), 1);
  await page.getByLabel("搜索邮件").fill("不存在");
  assert.equal(await page.locator(".mail-row").count(), 0);
  await page.getByLabel("搜索邮件").fill("");
  checks.push("未读筛选与主题搜索");
  await page.locator(".mail-row").first().click();
  await page
    .locator(".mail-body")
    .getByText(/合成正文/)
    .waitFor();
  assert.equal(await page.evaluate(() => window.mailUnsafe), undefined);
  checks.push("纯文本显示不执行HTML");
  await page.getByRole("button", { name: "转为待办", exact: true }).click();
  await page.getByText("已添加到收集箱，可在任务清单编辑").waitFor();
  await page.getByRole("button", { name: "转为待办", exact: true }).click();
  await page.getByText("这封邮件已有待办").waitFor();
  const snapshot = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(snapshot.tasks.length, 1);
  assert(!JSON.stringify(snapshot).includes("synthetic-ui-mail-secret"));
  checks.push("转待办去重与密码不进快照");
  for (const [width, height] of [
    [1400, 900],
    [820, 650],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, `mail-${width}.png`) });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
  }
  checks.push("宽窄窗口截图与水平溢出检查");
  await page.getByRole("button", { name: "断开", exact: true }).click();
  await page.getByRole("button", { name: "连接邮箱", exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("邮箱密码", { exact: true }).inputValue(),
    "",
  );
  const disconnected = await page.evaluate(() =>
    window.veritas.call("mail.state"),
  );
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.items.length, 0);
  checks.push("断开清空邮件和密码");
  await page.evaluate(() => window.veritas.call("account.logout"));
  await assert.rejects(
    page.evaluate(() => window.veritas.call("mail.state")),
    /请先登录/,
  );
  assert.equal(
    (await page.evaluate(() => window.veritas.call("state"))).mail,
    undefined,
  );
  checks.push("退出账号门禁与锁定快照");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "mail-ui.json"),
    JSON.stringify({ checks, errors, synthetic: true }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} finally {
  await app?.close();
}
