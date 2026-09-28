import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../electron/store.mjs";
import { AccountProfiles } from "../electron/accounts/profiles.mjs";
import { AccountSync } from "../electron/accounts/sync.mjs";
import { Accounts } from "../electron/accounts/service.mjs";
import { initialState, taskInput } from "../src/domain.mjs";
import { cloudDocument, validateCloudDocument } from "../src/cloud-data.mjs";
const directory = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "hades-account-"));
const vault = () => ({
  data: {},
  load() {
    return structuredClone(this.data);
  },
  save(p) {
    this.data = { ...this.data, ...p };
  },
});
test("同步仅选择允许数据，删除状态和专注原始区间保留，计时和凭据不上传", () => {
  const s = initialState();
  s.tasks = [
    { ...taskInput({ quadrant: "plan", title: "删除任务" }), deletedAt: 1000 },
  ];
  s.secret = "synthetic";
  s.scores = { items: [] };
  s.logs = [
    {
      id: "log",
      title: "专注",
      segments: [{ start: 1000, end: 2000 }],
      mode: "focus",
      completed: true,
    },
  ];
  const doc = validateCloudDocument(cloudDocument(s));
  assert.equal(doc.tasks[0].deletedAt, 1000);
  assert.deepEqual(doc.logs[0].segments, s.logs[0].segments);
  assert.equal(doc.logs[0].durationMs, 1000);
  assert.ok(!("timer" in doc) && !("secret" in doc) && !("scores" in doc));
  assert.throws(() => validateCloudDocument({ ...doc, unknown: 1 }));
});
test("账号各有独立目录，复制不覆盖已有账号，也不移动原始数据", () => {
  const dir = directory(),
    profiles = new AccountProfiles(dir, vault()),
    s = initialState();
  s.tasks = [taskInput({ quadrant: "plan", title: "原始任务" })];
  fs.writeFileSync(path.join(dir, "veritas-data.json"), JSON.stringify(s));
  const a = { id: "../synthetic-a" },
    b = { id: "b" };
  const ad = profiles.prepare(a, s);
  profiles.prepare(b, initialState());
  assert.ok(ad.startsWith(path.join(dir, "accounts")));
  assert.notEqual(ad, profiles.directory(b));
  profiles.prepare(a, initialState());
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(ad, "veritas-data.json"))).tasks
      .length,
    1,
  );
  profiles.select(a);
  assert.equal(profiles.directory(), ad);
  profiles.select(null);
  assert.equal(profiles.directory(), dir);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, "veritas-data.json"))).tasks
      .length,
    1,
  );
});
function setup() {
  const dir = directory(),
    store = new Store(dir);
  let remote = { version: 0, document: null };
  const provider = {
    current: async () => ({ id: "A" }),
    request: async (p) => {
      if (p.action === "pull") return structuredClone(remote);
      if (p.version !== remote.version)
        return { conflict: true, version: remote.version };
      remote = {
        version: remote.version + 1,
        document: structuredClone(p.document),
      };
      return { version: remote.version };
    },
  };
  const sync = new AccountSync({
    directory: dir,
    store,
    provider,
    user: { id: "A" },
  });
  return {
    dir,
    store,
    provider,
    sync,
    get remote() {
      return remote;
    },
    set remote(v) {
      remote = v;
    },
  };
}
test("双向同步与冲突保留双方，选择远端不覆盖本机正在运行的计时", async () => {
  const x = setup();
  x.store.change((s) =>
    s.tasks.push(taskInput({ quadrant: "plan", title: "本机初始" })),
  );
  await x.sync.configure(true);
  assert.equal(x.remote.version, 1);
  x.remote.document.tasks[0].title = "远端改动";
  x.remote.version++;
  await x.sync.run();
  assert.equal(x.store.state.tasks[0].title, "远端改动");
  x.store.change((s) => {
    s.tasks[0].title = "本机新改";
    s.timer.status = "paused";
    s.timer.segments = [{ start: 1000, end: 2500 }];
  });
  x.remote.document.tasks[0].title = "云端新改";
  x.remote.version++;
  await x.sync.run();
  assert.equal(x.sync.status().phase, "conflict");
  assert.equal(x.store.state.tasks[0].title, "本机新改");
  await x.sync.run("remote");
  assert.equal(x.store.state.tasks[0].title, "云端新改");
  assert.equal(x.store.state.timer.status, "paused");
  assert.deepEqual(x.store.state.timer.segments, [{ start: 1000, end: 2500 }]);
  assert.ok(fs.readdirSync(path.join(x.dir, "sync-backups")).length >= 2);
});
test("断网和账号错配不修改数据，上传途中继续编辑留待下次同步", async () => {
  const x = setup();
  await x.sync.configure(true);
  const before = JSON.stringify(x.store.state);
  x.provider.current = async () => ({ id: "B" });
  await x.sync.run();
  assert.equal(x.sync.status().phase, "error");
  assert.equal(JSON.stringify(x.store.state), before);
  x.provider.current = async () => ({ id: "A" });
  x.provider.request = async () => {
    throw Error("offline");
  };
  await x.sync.run();
  assert.equal(JSON.stringify(x.store.state), before);
  const y = setup(),
    request = y.provider.request;
  y.provider.request = async (p) => {
    const r = await request(p);
    if (p.action === "push")
      y.store.change((s) =>
        s.tasks.push(taskInput({ quadrant: "plan", title: "上传时新建" })),
      );
    return r;
  };
  await y.sync.configure(true);
  assert.equal(y.remote.document.tasks.length, 0);
  y.provider.request = request;
  await y.sync.run();
  assert.equal(y.remote.document.tasks.length, 1);
});
test("切换前要求保存计时，不允许把一个账号的数据复制给另一个账号", async () => {
  const dir = directory(),
    store = new Store(dir),
    profiles = new AccountProfiles(dir, vault());
  let restarted = false;
  const service = new Accounts({
    profiles,
    store,
    provider: { config: { env: "" } },
    restart: () => {
      restarted = true;
    },
    changed: () => {},
  });
  service.pendingUser = { id: "A" };
  store.state.timer.status = "paused";
  await assert.rejects(() =>
    service.execute("account.activate", { mode: "copy" }),
  );
  assert.equal(restarted, false);
  store.state.timer.status = "idle";
  profiles.select({ id: "B" });
  await assert.rejects(() =>
    service.execute("account.activate", { mode: "copy" }),
  );
  assert.equal(restarted, false);
  await service.execute("account.activate", { mode: "empty" });
  assert.equal(restarted, true);
  assert.equal(profiles.active.id, "A");
});
