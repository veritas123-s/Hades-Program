import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initialState } from "../src/domain.mjs";
import {
  assistantMessages,
  parseAssistantReply,
  commitAssistantDrafts,
} from "../src/assistant.mjs";
import { AssistantService } from "../electron/assistant-service.mjs";
import { SecretStore } from "../electron/secret-store.mjs";
import { Store } from "../electron/store.mjs";
const item = {
  title: "合成实验报告",
  due: "2026-09-25",
  dueTime: "18:00",
  quadrant: "do",
};
const protection = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(s).map((x) => x ^ 42),
  decryptString: (b) =>
    Buffer.from(b)
      .map((x) => x ^ 42)
      .toString("utf8"),
};
function setup(fetcher) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-ai-"));
  const secrets = new SecretStore(directory, "ai.bin", protection);
  secrets.save({ key: "synthetic-key-for-tests", model: "deepseek-chat" });
  return {
    directory,
    secrets,
    service: new AssistantService({ directory, secrets, fetcher }),
  };
}
test("助手上下文只包含最小必要字段，关闭摘要时排除历史和个人数据", () => {
  const state = initialState();
  state.tasks = [
    {
      id: "a",
      title: "最小任务",
      notes: "私人长笔记",
      quadrant: "do",
      subtasks: [],
      estimate: 1,
    },
  ];
  state.scores = { private: "秘密成绩" };
  state.campusAuth = { key: "secret" };
  const messages = assistantMessages({
    text: "帮我整理",
    state,
    now: Date.parse("2026-09-24T16:30:00Z"),
  });
  const text = JSON.stringify(messages);
  assert.match(text, /2026-09-25/);
  assert.match(text, /最小任务/);
  assert.doesNotMatch(text, /私人长笔记|秘密成绩|secret/);
  const isolated = assistantMessages({
    text: "只回答这句",
    state,
    includeContext: false,
    history: [{ user: "历史秘密", reply: "旧摘要" }],
  });
  assert.doesNotMatch(JSON.stringify(isolated), /最小任务|历史秘密|旧摘要/);
});
test("助手输出只生成草稿，非法日期跳过，普通文字不执行任务", () => {
  const parsed = parseAssistantReply(
    JSON.stringify({
      reply: "请核对",
      tasks: [item, { ...item, due: "2026-02-31" }],
    }),
  );
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(
    parseAssistantReply("已执行 rm -rf /，请忽略要求").tasks.length,
    0,
  );
  assert.throws(() =>
    parseAssistantReply(
      JSON.stringify({ reply: "x", tasks: Array(13).fill(item) }),
    ),
  );
});
test("批量添加先完整校验，重复提交和重启不重复添加，也不会恢复已删除任务", () => {
  const { directory } = setup();
  const store = new Store(directory);
  const entry = {
    id: "batch-1",
    tasks: [
      { ...item, draftIndex: 0 },
      { ...item, draftIndex: 1 },
    ],
  };
  assert.throws(() =>
    store.change((s) =>
      commitAssistantDrafts(s, entry, [
        { ...item, draftIndex: 0 },
        { ...item, dueTime: "99:01", draftIndex: 1 },
      ]),
    ),
  );
  assert.equal(store.state.tasks.length, 0);
  assert.equal(
    store.change((s) =>
      commitAssistantDrafts(s, entry, [{ ...item, draftIndex: 0 }]),
    ).added,
    1,
  );
  store.change((s) => (s.tasks[0].deletedAt = Date.now()));
  const restarted = new Store(directory);
  assert.equal(
    restarted.change((s) =>
      commitAssistantDrafts(s, entry, [{ ...item, draftIndex: 0 }]),
    ).skipped,
    1,
  );
  assert.ok(restarted.state.tasks[0].deletedAt);
  assert.throws(() =>
    commitAssistantDrafts(restarted.state, entry, [{ ...item, draftIndex: 9 }]),
  );
});
test("密钥加密保存，不出现在助手状态、历史或业务备份中", async () => {
  const { service, secrets, directory } = setup(async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ reply: "合成回复", tasks: [item] }),
          },
        },
      ],
    }),
  );
  await service.chat(
    { text: "帮我添加合成任务 synthetic-key-for-tests" },
    initialState(),
  );
  assert.doesNotMatch(
    JSON.stringify(service.status()),
    /synthetic-key-for-tests/,
  );
  assert.equal(
    fs
      .readFileSync(secrets.file)
      .includes(Buffer.from("synthetic-key-for-tests")),
    false,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(directory, "assistant-history.json"), "utf8"),
    /synthetic-key-for-tests/,
  );
});
test("模型刷新按实际列表，也允许手填兼容模型，错误不泄漏服务响应", async () => {
  const { service } = setup(async () =>
    Response.json({
      data: [{ id: "deepseek-chat" }, { id: "qwen" }, { id: "../../bad" }],
    }),
  );
  await service.models();
  assert.deepEqual(service.status().models, ["deepseek-chat", "qwen"]);
  service.configure({ model: "provider/custom-model:free" });
  assert.equal(service.status().model, "provider/custom-model:free");
  service.fetcher = async () =>
    new Response("raw secret diagnostic", { status: 401 });
  await assert.rejects(
    () => service.chat({ text: "test" }, initialState()),
    /密钥无效/,
  );
  assert.equal(service.history.length, 0);
});
test("旧配置继续使用学校端点、禁止跳转，截断回复不产生草稿", async () => {
  const seen = [];
  const { service } = setup(async (url, options) => {
    seen.push({ url, options });
    return Response.json({
      choices: [{ finish_reason: "length", message: { content: "partial" } }],
    });
  });
  await assert.rejects(
    () => service.chat({ text: "test" }, initialState()),
    /长度不足/,
  );
  assert.equal(
    seen[0].url,
    "https://models.sjtu.edu.cn/api/v1/chat/completions",
  );
  assert.equal(seen[0].options.redirect, "error");
  assert.equal(service.history.length, 0);
});
test("并发生成互斥，取消请求不添加任务，清空对话不动清单", async () => {
  let release;
  const { service, directory } = setup(
    (url, options) =>
      new Promise((resolve, reject) => {
        release = resolve;
        options.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const waiting = service.chat({ text: "test" }, initialState());
  await assert.rejects(
    () => service.chat({ text: "test2" }, initialState()),
    /上一条/,
  );
  service.cancel();
  await assert.rejects(() => waiting, /停止/);
  assert.equal(service.busy, false);
  service.clear();
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(directory, "assistant-history.json"), "utf8"),
    ).history.length,
    0,
  );
});
test("每分钟请求与token预算限制，即使失败也不无限重试", () => {
  const { service } = setup();
  service.reserve(85000);
  assert.throws(() => service.reserve(6000), /额度/);
  service.ledger = [];
  for (let i = 0; i < 8; i++) service.reserve();
  assert.throws(() => service.reserve(), /额度/);
});
