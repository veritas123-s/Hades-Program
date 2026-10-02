import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initialState, taskInput } from "../src/domain.mjs";
import {
  unlockSyntheticAccount,
  clearSyntheticSession,
} from "./account-test-fixture.mjs";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-gate-"));
const seed = initialState();
seed.tasks = [taskInput({ title: "不得在登录前显示的任务", quadrant: "plan" })];
seed.logs = [
  {
    id: "synthetic-log",
    mode: "focus",
    title: "合成专注",
    durationMs: 2000,
    segments: [{ start: 1000, end: 3000 }],
    startedAt: 1000,
    endedAt: 3000,
    completed: true,
    deletedAt: null,
  },
];
seed.workspace.theme = "midnight";
fs.writeFileSync(
  path.join(directory, "veritas-data.json"),
  JSON.stringify(seed),
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : undefined;
const launch = () =>
  electron.launch({ executablePath, args: executablePath ? [] : ["."], env });
let app = await launch();
fs.mkdirSync("test-results", { recursive: true });
try {
  let page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("heading", { name: "登录 Medstack", exact: true })
    .waitFor();
  const call = (a, p) =>
    page.evaluate(([a, p]) => window.veritas.call(a, p), [a, p]);
  const s = await call("state");
  assert.equal(s.locked, true);
  assert.equal(s.tasks, undefined);
  assert.equal(s.workspace, undefined);
  assert.equal(await page.locator(".sidebar").count(), 0);
  assert.equal(await page.getByText(seed.tasks[0].title).count(), 0);
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    "paper",
  );
  for (const action of [
    "assistant.state",
    "briefing.state",
    "campus.sync",
    "workspace.configure",
    "account.sync",
  ])
    await assert.rejects(() => call(action, {}), /请先登录/);
  await page.keyboard.press("Control+n");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await page.getByLabel("邮箱", { exact: true }).fill("ui@synthetic.invalid");
  await page.getByLabel("密码", { exact: true }).fill("SyntheticPassword123!");
  await app.evaluate(({ net }) => {
    net.fetch = () => new Promise(() => {});
  });
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await page.getByRole("button", { name: "停止等待" }).click();
  await page.getByRole("alert").filter({ hasText: "停止等待" }).waitFor();
  await page.getByLabel("邮箱验证码").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "重新发送验证码" }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "登录", exact: true }).click();
  page = await unlockSyntheticAccount(app);
  await page.getByRole("button", { name: "复制本机数据到这个账号" }).click();
  await page.waitForFunction(() => document.body.textContent.includes("进入"));
  await clearSyntheticSession(app);
  await app.close();
  app = await launch();
  page = await unlockSyntheticAccount(app);
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  const restored = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(restored.tasks[0].title, seed.tasks[0].title);
  assert.deepEqual(restored.logs[0].segments, seed.logs[0].segments);
  assert.equal(restored.workspace.theme, "midnight");
  assert.equal(
    await page
      .evaluate(() => window.veritas.call("assistant.state"))
      .then((x) => x.configured),
    false,
  );
  await page.screenshot({ path: "test-results/v305-authenticated.png" });
  await page.evaluate(() => window.veritas.call("account.logout"));
  await page
    .getByRole("heading", { name: "登录 Medstack", exact: true })
    .waitFor();
  assert.equal(
    (await page.evaluate(() => window.veritas.call("state"))).tasks,
    undefined,
  );
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(directory, "veritas-data.json")))
      .logs[0].segments,
    seed.logs[0].segments,
  );
  await page.screenshot({ path: "test-results/v305-locked.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS 实际程序：登录隔离、所有个人接口阻断、停止等待、迁移与记录保留、重新登录解锁、退出锁定",
  );
} finally {
  await app.close();
}
