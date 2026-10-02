import {
  launchAuthenticated,
  fixtureProfile,
} from "./account-test-fixture.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { beijingDay } from "../src/briefing.mjs";
const root = process.cwd(),
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-v13-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [],
  errors = [],
  shots = [];
let app, page;
const call = (action, payload = {}) =>
  page.evaluate(
    ([action, payload]) => window.veritas.call(action, payload),
    [action, payload],
  );
const ok = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function start() {
  app = await launchAuthenticated({ args: [root], env });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  await app.evaluate(({ net }, due) => {
    const original = net.fetch.bind(net);
    net.fetch = async (url, options) => {
      if (url.startsWith("https://models.sjtu.edu.cn/api/v1/"))
        return new Response(
          JSON.stringify(
            url.endsWith("/models")
              ? { data: [{ id: "deepseek-chat" }, { id: "qwen" }] }
              : {
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          reply: "已整理出两项任务，请核对后添加。",
                          tasks: [
                            {
                              title: "合成实验报告",
                              due,
                              dueTime: "18:00",
                              quadrant: "do",
                              project: "课程",
                              subtasks: [
                                { title: "整理结果" },
                                { title: "检查格式" },
                              ],
                            },
                            {
                              title: "合成长期计划",
                              quadrant: "plan",
                              project: "科研",
                            },
                          ],
                        }),
                      },
                    },
                  ],
                },
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      if (url === "https://synthetic.ap-shanghai.tencentscf.com/veritas-sync") {
        const hash = process
          .getBuiltinModule("crypto")
          .createHash("sha256")
          .update(options.body)
          .digest("hex");
        return new Response(
          JSON.stringify({
            status: "stored",
            sha256: hash,
            generated_at: JSON.parse(options.body).generated_at,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return original(url, options);
    };
  }, beijingDay());
}
async function shot(name) {
  await page.screenshot({ path: path.join(root, "test-results", name) });
  shots.push(name);
}
try {
  await start();
  const tour = page.getByRole('dialog', { name: '医栈通 新手教程' });
  if(await tour.isVisible()) await tour.getByRole('button',{name:'跳过',exact:true}).click();
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page.getByLabel("API 密钥").fill("synthetic-api-key-never-real");
  await page
    .getByRole("button", { name: "保存并检查连接", exact: true })
    .click();
  await page.getByLabel("助手模型").selectOption("qwen");
  await page.getByRole("button", { name: "助手连接设置", exact: true }).click();
  await page.getByLabel("对助手说").fill("帮我添加合成实验报告和长期计划");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByLabel("草稿任务名称 1").waitFor();
  assert.equal((await call("state")).tasks.length, 0);
  await page.getByLabel("草稿任务名称 1").fill("人工核对后的实验报告");
  await shot("v13-ai-drafts-monument.png");
  await page
    .getByRole("button", { name: "添加 2 项任务", exact: true })
    .click();
  await page.getByText("已添加 2 项任务", { exact: true }).waitFor();
  const added = await call("state");
  assert.equal(added.tasks.length, 2);
  assert.equal(added.tasks[0].title, "人工核对后的实验报告");
  assert.equal(
    await page
      .getByRole("button", { name: "添加 0 项任务", exact: true })
      .isDisabled(),
    true,
  );
  ok("助手从配置、生成、编辑到批量入库全程可用，草稿不会提前写入或重复创建");
  await page.getByRole("button", { name: "查看早晚报", exact: true }).click();
  await page.getByRole("heading", { name: "早晚报", exact:true }).waitFor();
  assert.ok(
    (await call("briefing.state")).preview.deadlines.some(
      (t) => t.title === "人工核对后的实验报告",
    ),
  );
  await page.getByRole("button", { name: "云同步连接设置" }).click();
  await page
    .getByLabel("云同步地址")
    .fill("https://synthetic.ap-shanghai.tencentscf.com/veritas-sync");
  await page.getByLabel("云同步密钥").fill("a".repeat(64));
  await page.getByRole("button", { name: "保存连接", exact: true }).click();
  await page.getByRole("button", { name: "立即同步", exact: true }).click();
  await page.locator(".cloud-sync-card.sync-synced").waitFor();
  await shot("v13-briefing-sync.png");
  ok("批量创建立即进入早晚报预览，签名同步和云端摘要确认在界面正确显示");
  await call("task.complete", { id: added.tasks[0].id });
  assert.equal((await call("briefing.state")).preview.deadlines.length, 0);
  await call("briefing.sync.now");
  assert.equal(
    JSON.parse(
      fs.readFileSync(
        path.join(fixtureProfile(directory), "briefing", "veritas-feed.json"),
        "utf8",
      ),
    ).tasks.length,
    1,
  );
  ok("完成任务从下次快报数据移除，保留其余重要任务");
  for (const theme of ["paper", "midnight"]) {
    await call("workspace.configure", { theme });
    await page
      .getByRole("button", { name: "打开 AI 助手", exact: true })
      .click();
    await page.getByLabel("对助手说").waitFor();
    await shot(`v13-ai-${theme}.png`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page
      .getByRole("button", { name: "关闭 AI 助手", exact: true })
      .click();
  }
  ok("助手与同步页面沿用三套主题，无横向溢出");
  const vault = fs.readFileSync(
    path.join(fixtureProfile(directory), "assistant-vault.bin"),
  );
  assert.equal(
    vault.includes(Buffer.from("synthetic-api-key-never-real")),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(await call("state")),
    /synthetic-api-key-never-real/,
  );
  await app.close();
  await start();
  const saved = await call("assistant.state");
  assert.equal(saved.configured, true);
  assert.equal(saved.model, "qwen");
  assert.equal(saved.history.length, 1);
  assert.ok(saved.history[0].tasks.every((t) => t.added));
  const repeated = await call("assistant.commit", {
    id: saved.history[0].id,
    tasks: saved.history[0].tasks,
  });
  assert.equal(repeated.commit.added, 0);
  assert.equal(repeated.commit.skipped, 2);
  await call("assistant.clear");
  assert.equal((await call("state")).tasks.length, 2);
  ok("重启保留加密连接和对话，重复添加去重，清空对话不删除任务");
  assert.deepEqual(errors, []);
  ok("真实 Electron 界面无脚本错误");
  fs.writeFileSync(
    "test-results/assistant-desktop.json",
    JSON.stringify(
      { passed: true, checks, shots, errors, data: directory },
      null,
      2,
    ),
  );
} finally {
  await app?.close();
}
