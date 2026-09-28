import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hades-v2-ui-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch(
  process.argv[2]
    ? { executablePath: path.resolve(process.argv[2]), args: [], env }
    : { args: [process.cwd()], env },
);
const checks = [];
const ok = (x) => {
  checks.push(x);
  console.log("PASS " + x);
};
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  const call = (a, p = {}) =>
    page.evaluate(([a, p]) => window.veritas.call(a, p), [a, p]);
  await app.evaluate(({ session, net }) => {
    const s = session.fromPartition("hades-learning");
    s.fetch = async (url, options) => {
      if (url.includes("backclazzdata"))
        return new Response(
          JSON.stringify({
            result: 1,
            channelList: [
              {
                content: {
                  id: 2,
                  cpi: 3,
                  isretire: 0,
                  course: { data: [{ id: 1, name: "合成课程" }] },
                },
              },
            ],
          }),
        );
      if (url.includes("stucoursemiddle"))
        return new Response(
          '<input id="workEnc" value="0123456789abcdef0123456789abcdef"><input id="enc" value="stub"><input id="openc" value="stub">',
        );
      if (url.includes("/work/list"))
        return new Response(
          '<ul><li data="https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?workId=4"><p class="overHidden2">合成作业</p><p class="status">未交</p><div class="time">2026-09-28 18:00</div></li></ul><div id="page"><li>1</li></div><script>throw Error("must not execute")</script>',
        );
      if (url.includes("getNoticeList"))
        return new Response(
          JSON.stringify({
            status: true,
            notices: {
              list: [
                {
                  id: 5,
                  title: "合成课程通知",
                  createrName: "合成老师",
                  completeTime: Date.now(),
                },
              ],
              lastPage: true,
            },
          }),
        );
      throw Error("Unexpected URL");
    };
    net.fetch = async (url, options) =>
      new Response(
        JSON.stringify(
          url.endsWith("/models")
            ? {
                data: [
                  { id: "deepseek-chat" },
                  { id: "deepseek-reasoner" },
                  { id: "qwen3coder" },
                ],
              }
            : {
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        reply: "已整理",
                        tasks: [{ title: "合成自动任务", quadrant: "plan" }],
                      }),
                    },
                  },
                ],
              },
        ),
      );
  });
  await call("learning.sync");
  let s = await call("state");
  assert.equal(s.learning.coveredCourses, 1);
  assert.equal(s.learning.noticeOk, true);
  assert.equal(s.tasks[0].dueTime, "18:00");
  assert.equal(s.logs.length, 0);
  assert.equal(s.learning.items.length, 2);
  assert.ok(!JSON.stringify(s).includes("0123456789abcdef"));
  ok("作业与通知解析、自动入库、DDL进入任务，令牌不进入状态");
  await page.getByRole("button", { name: "打开通知中心" }).click();
  await page
    .getByRole("heading", { name: "日程与通知", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "超星通知", exact: true }).click();
  await page
    .getByRole("heading", { name: "合成课程通知", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "本页标为已读" }).click();
  s = await call("state");
  assert.equal(s.workflows.read.length, 1);
  await page.screenshot({
    path: "test-results/v2-notifications.png",
    fullPage: true,
  });
  ok("通知中心分类、未读状态、工作流记录");
  const cached = JSON.stringify(s.learning.items);
  await app.evaluate(() => {
    const Real = Date.now;
    Date.now = () => Real() + 61000;
  });
  await app.evaluate(({ session }) => {
    session.fromPartition("hades-learning").fetch = async () =>
      new Response("<html>login</html>");
  });
  await assert.rejects(() => call("learning.sync"));
  s = await call("state");
  assert.equal(JSON.stringify(s.learning.items), cached);
  ok("登录过期/非JSON响应不清空已有学习通缓存");
  await page.getByRole("button", { name: "专注空间", exact: true }).click();
  await page.getByLabel("本次专注分钟").fill("45");
  await page.getByRole("button", { name: "开始专注", exact: true }).click();
  s = await call("state");
  assert.equal(s.timer.targetMs, 45 * 60000);
  await call("timer", { action: "pause" });
  await call("timer", { action: "reset" });
  await page.getByLabel("补记分钟").fill("30");
  await page.getByLabel("补记结束时间").fill("2026-09-26T12:00");
  await page.getByLabel("补记工作内容").fill("合成补记");
  await page.getByRole("button", { name: "保存补记" }).click();
  await page.getByText("已保存，可在时间记录中查看或撤销。").waitFor();
  s = await call("state");
  assert.equal(s.logs[0].durationMs, 1800000);
  assert.equal(s.logs[0].mode, "manual");
  await page.screenshot({ path: "test-results/v2-focus.png", fullPage: true });
  ok("自选45分钟番茄和30分钟手动补记，真实区间校验");
  await call("assistant.configure", {
    key: "synthetic-v2-test-key",
    model: "deepseek-chat",
  });
  await call("assistant.models");
  await call("workflow.configure", { autoCommit: true });
  await call("assistant.chat", {
    text: "添加一个学习计划任务",
    includeContext: true,
    model: "auto",
  });
  let ai = await call("assistant.state");
  assert.equal(ai.history.at(-1).model, "deepseek-reasoner");
  s = await call("state");
  assert.ok(s.tasks.some((t) => t.title === "合成自动任务"));
  const audit = s.workflows.audit[0];
  await call("workflow.undo", { id: audit.id });
  s = await call("state");
  assert.ok(s.tasks.find((t) => t.title === "合成自动任务").deletedAt);
  ok("自动选择规划模型、授权自动建任务和撤销");
  await page.getByRole("button", { name: "打开 AI 助手", exact: true }).click();
  await page.getByLabel("本次模型").selectOption("default");
  await page.screenshot({
    path: "test-results/v2-poseidon.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  ok("V2页面无脚本错误和横向溢出");
  fs.writeFileSync(
    "test-results/v2-report.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        syntheticLearning: true,
        realAccountVerified: false,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
