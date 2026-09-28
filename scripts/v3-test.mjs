import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { initialState, taskInput } from "../src/domain.mjs";
import { THEMES } from "../src/themes/catalog.mjs";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hades3-ui-"));
const seed = initialState();
seed.workspace.theme = "paper";
seed.tasks = [
  taskInput({ title: "合成测试任务", quadrant: "plan", due: "2026-09-29" }),
];
seed.lists.push(
  ...Array.from({ length: 28 }, (_, i) => ({
    id: "list:" + i,
    name: "合成清单 " + i,
    deletedAt: null,
  })),
);
fs.writeFileSync(
  path.join(directory, "veritas-data.json"),
  JSON.stringify(seed),
);
const calendar = path.join(directory, "synthetic.ics");
fs.writeFileSync(
  calendar,
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:hades-v3-synthetic\r\nSUMMARY:合成导入日程\r\nDTSTART:20260929T010000Z\r\nDTEND:20260929T020000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
);
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : undefined;
const app = await electron.launch({
  executablePath,
  args: executablePath && !process.argv.includes("--runtime") ? [] : ["."],
  env,
});
const errors = [];
fs.mkdirSync("test-results", { recursive: true });
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "今天的安排" }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const call = (a, p) =>
    page.evaluate(([a, p]) => window.veritas.call(a, p), [a, p]);
  assert.equal((await call("state")).schemaVersion, 5);
  const dimensions = await page.locator(".brand-symbol").boundingBox();
  assert.equal(dimensions.width, dimensions.height);
  const side = await page.locator(".sidebar-scroll").evaluate((e) => ({
    overflow: getComputedStyle(e).overflowY,
    height: e.clientHeight,
    scroll: e.scrollHeight,
  }));
  assert.ok(["auto", "scroll"].includes(side.overflow));
  assert.ok(side.scroll > side.height);
  await page.getByLabel("搜索任务", { exact: true }).fill("合成测试");
  assert.equal(
    await page
      .locator(".search input")
      .evaluate((e) => getComputedStyle(e).borderWidth),
    "0px",
  );
  await page.getByLabel("清空搜索").click();
  assert.equal(
    await page.getByLabel("搜索任务", { exact: true }).inputValue(),
    "",
  );
  console.log("PASS 搜索焦点单层边框，图标固定方形，导航区域独立滚动");
  await page.getByLabel("账号与同步", { exact: true }).click();
  await page
    .getByRole("heading", { name: "账号与同步", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "登录", exact: true }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await page.getByRole("heading", { name: "创建云端账号" }).waitFor();
  await page.getByRole("button", { name: "忘记密码", exact: true }).click();
  await page.getByRole("heading", { name: "找回密码" }).waitFor();
  await page.screenshot({ path: "test-results/v3-account.png" });
  assert.equal((await call("state")).account.ready, true);
  assert.equal(
    await page
      .getByText(
        "云端服务尚未开通。当前数据仍完整保存在这台电脑，开通后即可注册和同步。",
      )
      .count(),
    0,
  );
  console.log("PASS 账号入口、注册找回界面、已配置云服务可用");
  await page.getByRole("button", { name: "日程日历", exact: true }).click();
  await page.getByRole("button", { name: "导入 / 导出日历" }).click();
  await page.getByRole("button", { name: "导入日历", exact: true }).click();
  await page.getByLabel("范围开始").fill("2026-09-01");
  await page.getByLabel("范围结束").fill("2026-10-31");
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, calendar);
  await page.getByRole("button", { name: "选择 ICS 文件" }).click();
  await page.getByRole("heading", { name: "将添加 1 条日程" }).waitFor();
  assert.equal((await call("state")).events.length, 0);
  await page.getByRole("button", { name: "确认添加 1 条" }).click();
  await page
    .getByText("已添加 1 条日程。可在日历中编辑、删除与恢复。")
    .waitFor();
  assert.equal((await call("state")).events[0].start, "2026-09-29T09:00");
  await page.getByRole("button", { name: "选择 ICS 文件" }).click();
  await page.getByRole("heading", { name: "将添加 0 条日程" }).waitFor();
  console.log("PASS ICS worker预览、确认写入、再次导入去重");
  await page.getByRole("dialog").getByLabel("关闭", { exact: true }).click();
  await page.getByRole("button", { name: "今日概览", exact: true }).click();
  for (const theme of THEMES) {
    await call("workspace.configure", { theme: theme.id });
    await page.screenshot({ path: `test-results/v3-theme-${theme.id}.png` });
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 820),
  );
  await page.getByLabel("账号与同步", { exact: true }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "test-results/v3-narrow.png" });
  assert.deepEqual(errors, []);
  console.log("PASS 七主题与窄窗口布局，无页面异常");
  console.log(
    JSON.stringify(
      await app.evaluate(() => ({
        arch: process.arch,
        electron: process.versions.electron,
      })),
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
