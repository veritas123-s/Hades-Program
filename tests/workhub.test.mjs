import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  initialState,
  validateState,
  taskInput,
  completeTask,
} from "../src/domain.mjs";
import {
  changeHub,
  projectSummary,
  searchHub,
  validateHub,
} from "../src/domain/workhub.mjs";
import { cloudDocument, validateCloudDocument } from "../src/cloud-data.mjs";
import { Store } from "../electron/store.mjs";
import { AccountSync } from "../electron/accounts/sync.mjs";
import {
  requireAccount,
  lockedSnapshot,
} from "../electron/accounts/access.mjs";
import { researchTool } from "../src/agent/research-tool.mjs";
import { runPi } from "../src/agent/pi-runtime.mjs";
import { assistantMessages } from "../src/assistant.mjs";
import workspaceCommand from "../electron/commands/workspace.mjs";

test("恢复组件布局不会清除导航偏好或重复触发新手教程", async () => {
  const store = new Store(
    fs.mkdtempSync(path.join(os.tmpdir(), "medstack-reset-")),
  );
  store.change((s) => {
    s.workspace.onboardingVersion = 1;
    s.workspace.navigation = { collapsed: true, hidden: ["knowledge"] };
    project(s);
  });
  const before = structuredClone(store.state);
  await workspaceCommand("workspace.reset", {}, { store });
  assert.deepEqual(
    store.state.workspace.navigation,
    before.workspace.navigation,
  );
  assert.equal(store.state.workspace.onboardingVersion, 1);
  assert.deepEqual(store.state.workhub, before.workhub);
});

const project = (s) => {
  const id = changeHub(s, "hub.save", {
    collection: "projects",
    title: "合成研究项目",
    objective: "可证伪的研究问题",
    stage: "active",
    due: "2026-10-30",
  });
  return s.workhub.projects.find((p) => p.id === id);
};
const note = (s, projectId = "", aiVisible = false) => {
  const id = changeHub(s, "hub.save", {
    collection: "notes",
    title: "合成知识",
    kind: "literature",
    projectId,
    body: "测试marker 的机制与证据",
    aiVisible,
  });
  return s.workhub.notes.find((n) => n.id === id);
};
const current = (s, kind, id) => s.workhub[kind].find((x) => x.id === id);

test("v5迁移、完整备份与重启保留任务、原始区间及工作台", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-hub-test-"));
  const old = initialState();
  old.schemaVersion = 5;
  delete old.workhub;
  old.tasks = [taskInput({ title: "合成任务", quadrant: "plan" })];
  const bytes = JSON.stringify(old);
  fs.writeFileSync(path.join(dir, "veritas-data.json"), bytes);
  const store = new Store(dir);
  assert.equal(store.state.schemaVersion, 6);
  assert.deepEqual(store.state.tasks, validateState(old).tasks);
  assert.equal(
    fs.readFileSync(
      path.join(
        dir,
        fs
          .readdirSync(dir)
          .find((f) => f.startsWith("veritas-data.pre-schema5")),
      ),
      "utf8",
    ),
    bytes,
  );
  store.change((s) => {
    const p = project(s);
    note(s, p.id);
  });
  assert.deepEqual(validateState(store.state).workhub, store.state.workhub);
  assert.deepEqual(new Store(dir).state.workhub, store.state.workhub);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(store.backup())).workhub,
    store.state.workhub,
  );
});
test("项目关联任务与日程、完成度和原始专注统计，软删除可恢复", () => {
  const s = initialState();
  let p = project(s);
  changeHub(s, "hub.createTask", {
    id: p.id,
    revision: p.revision,
    task: { title: "检验假设", due: "2026-01-01" },
  });
  p = current(s, "projects", p.id);
  changeHub(s, "hub.createEvent", {
    id: p.id,
    revision: p.revision,
    event: {
      title: "讨论",
      start: "2026-10-04T09:00",
      end: "2026-10-04T10:00",
    },
  });
  p = current(s, "projects", p.id);
  assert.equal(projectSummary(s, p).overdue, 1);
  completeTask(s, s.tasks[0].id);
  s.logs = [
    {
      id: "log",
      taskId: s.tasks[0].id,
      durationMs: 1000,
      segments: [{ start: 1000, end: 2000 }],
    },
  ];
  const summary = projectSummary(s, p);
  assert.equal(summary.progress, 100);
  assert.equal(summary.focusMs, 1000);
  assert.equal(summary.events.length, 1);
  const logs = structuredClone(s.logs);
  changeHub(s, "hub.delete", {
    collection: "projects",
    id: p.id,
    revision: p.revision,
  });
  assert.deepEqual(s.logs, logs);
  assert.equal(s.tasks[0].deletedAt, null);
  p = current(s, "projects", p.id);
  changeHub(s, "hub.restore", {
    collection: "projects",
    id: p.id,
    revision: p.revision,
  });
  assert.equal(projectSummary(s, current(s, "projects", p.id)).progress, 100);
});
test("失败事务、过期编辑、缺失关联与非法日期不落盘", () => {
  const store = new Store(
    fs.mkdtempSync(path.join(os.tmpdir(), "medstack-hub-atomic-")),
  );
  store.change((s) => project(s));
  const p = store.state.workhub.projects[0];
  const before = fs.readFileSync(store.file, "utf8");
  for (const [action, payload] of [
    ["hub.save", { ...p, collection: "projects", revision: 0 }],
    ["hub.createTask", { ...p, task: { title: "非法", due: "2026-02-30" } }],
    ["hub.link", { ...p, target: "tasks", targetId: "missing" }],
    [
      "hub.save",
      {
        collection: "notes",
        title: "非法",
        kind: "note",
        projectId: "missing",
      },
    ],
  ]) {
    assert.throws(() => store.change((s) => changeHub(s, action, payload)));
    assert.equal(fs.readFileSync(store.file, "utf8"), before);
  }
});
test("知识修订与恢复保留历史且不自动恢复AI授权", () => {
  const s = initialState();
  let n = note(s, "", true);
  changeHub(s, "hub.save", {
    ...n,
    collection: "notes",
    body: "新的实际观察",
    aiVisible: false,
  });
  n = current(s, "notes", n.id);
  assert.equal(n.history.length, 1);
  changeHub(s, "hub.noteRestore", { id: n.id, revision: n.revision, index: 0 });
  n = current(s, "notes", n.id);
  assert.match(n.body, /marker/);
  assert.equal(n.aiVisible, false);
  assert.equal(n.history.at(-1).body, "新的实际观察");
});
test("知识授权与删除边界、关闭上下文、畸形工作台严格拒绝", () => {
  const s = initialState();
  const p = project(s);
  const n = note(s, p.id);
  note(s, "", true);
  assert.equal(searchHub(s, "marker").length, 2);
  assert.equal(searchHub(s, "marker", { aiOnly: true }).length, 1);
  changeHub(s, "hub.delete", {
    collection: "notes",
    id: n.id,
    revision: n.revision,
  });
  assert.equal(searchHub(s, "marker").length, 1);
  const messages = assistantMessages({
    text: "查看工作台",
    state: s,
    includeContext: false,
  });
  assert.ok(!JSON.stringify(messages).includes("合成研究项目"));
  assert.throws(
    () =>
      validateHub({
        ...s.workhub,
        projects: [...s.workhub.projects, ...s.workhub.projects],
      }),
    /重复/,
  );
  assert.throws(() => validateHub({ ...s.workhub, version: 2 }), /版本/);
  for (const action of ["hub.save", "hub.noteRestore", "hub.delete"])
    assert.throws(
      () => requireAccount({ authenticated: false }, action),
      /登录/,
    );
  assert.ok(!("workhub" in lockedSnapshot({}, 1)));
});
test("云端v5兼容，拉取和冲突解决不丢失本机科研记录或降级schema", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-hub-sync-"));
  const store = new Store(dir);
  store.change((s) => {
    project(s);
    note(s);
  });
  const hub = structuredClone(store.state.workhub);
  const doc = cloudDocument(store.state);
  assert.equal(doc.schemaVersion, 5);
  assert.ok(!("workhub" in doc));
  assert.deepEqual(validateCloudDocument(doc), doc);
  let remote = { version: 0, document: null };
  const sync = new AccountSync({
    directory: dir,
    store,
    user: { id: "synthetic" },
    provider: {
      current: async () => ({ id: "synthetic" }),
      request: async (p) => {
        if (p.action === "pull") return remote;
        remote = { version: remote.version + 1, document: p.document };
        return { version: remote.version };
      },
    },
  });
  await sync.configure(true);
  remote = {
    version: 2,
    document: {
      ...doc,
      tasks: [taskInput({ title: "云端合成任务", quadrant: "plan" })],
    },
  };
  await sync.run();
  assert.equal(sync.phase, "synced");
  assert.equal(store.state.schemaVersion, 6);
  assert.deepEqual(store.state.workhub, hub);
  assert.equal(store.state.tasks[0].title, "云端合成任务");
  assert.deepEqual(new Store(dir).state.workhub, hub);
  sync.stop();
});
test("Pi实际工具循环只返回授权知识，传回模型并正常结束", async () => {
  const s = initialState();
  note(s, "", false);
  const n = note(s, "", true);
  n.title = "授权测试";
  let step = 0;
  const result = await runPi({
    model: "synthetic",
    messages: [
      { role: "system", content: "测试" },
      { role: "user", content: "查询marker" },
    ],
    tools: [researchTool(() => s)],
    request: async (body) => {
      if (++step === 1)
        return {
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                tool_calls: [
                  {
                    id: "research-1",
                    type: "function",
                    function: {
                      name: "search_research",
                      arguments: '{"query":"marker"}',
                    },
                  },
                ],
              },
            },
          ],
        };
      const output = JSON.parse(body.messages.at(-1).content);
      assert.equal(output.matches.length, 1);
      assert.equal(output.matches[0].title, "授权测试");
      return {
        choices: [{ finish_reason: "stop", message: { content: "检索完成" } }],
      };
    },
  });
  assert.equal(result.events[0].error, false);
  assert.equal(result.text, "检索完成");
});
