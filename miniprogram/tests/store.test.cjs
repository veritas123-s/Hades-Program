const test = require("node:test");
const assert = require("node:assert/strict");
const { Store, recordKey } = require("../lib/store");
const { Api } = require("../lib/api");
const d = require("../lib/domain");
const copy = (x) => JSON.parse(JSON.stringify(x));
function platform() {
  const memory = new Map();
  return {
    memory,
    getStorageSync: (key) => (memory.has(key) ? copy(memory.get(key)) : ""),
    setStorageSync: (key, value) => memory.set(key, copy(value)),
  };
}
function remote(document = null, version = 0) {
  return {
    document,
    version,
    pushes: 0,
    async call() {
      return { user: { id: "a" } };
    },
    async request(p) {
      if (p.action === "pull")
        return { document: copy(this.document), version: this.version };
      if (p.version !== this.version)
        return { conflict: true, version: this.version };
      this.document = copy(p.document);
      this.pushes++;
      return { version: ++this.version };
    },
  };
}
const task = (title = "合成任务") => d.taskInput({ title, quadrant: "plan" });
test("账号隔离、未登录保护、离线缓存恢复", () => {
  const wx = platform(),
    store = new Store(wx);
  assert.throws(() => store.mutate(() => {}), /登录/);
  store.open({ id: "a" });
  store.mutate((s) => s.tasks.push(task()));
  store.open({ id: "b" });
  assert.equal(store.state.tasks.length, 0);
  store.open({ id: "a" });
  assert.equal(store.state.tasks.length, 1);
  assert.equal(store.dirty, true);
  store.close();
  assert.equal(store.state, null);
});
test("演示数据不触发任何云端请求", async () => {
  const store = new Store(platform()).open({ id: "__medstack_demo__" }, true);
  store.mutate((s) => s.tasks.push(task()));
  await store.sync({
    call() {
      throw Error("不应调用");
    },
  });
  assert.match(store.status, /不连接/);
});
test("首次登录下载云端数据，保留课表与已有设置", async () => {
  const document = d.cloudDocument(d.initialState());
  document.tasks.push(task("云端任务"));
  document.settings.focusMinutes = 40;
  const api = remote(document, 4),
    store = new Store(platform()).open({ id: "a" });
  await store.sync(api);
  assert.equal(store.state.tasks[0].title, "云端任务");
  assert.equal(store.state.settings.focusMinutes, 40);
  assert.equal(api.pushes, 0);
  assert.equal(store.version, 4);
});
test("首次离线编辑与已有云端数据冲突，不覆盖；解决前保存两份备份", async () => {
  const wx = platform(),
    store = new Store(wx).open({ id: "a" }),
    document = d.cloudDocument(d.initialState());
  document.tasks.push(task("远端"));
  store.mutate((s) => s.tasks.push(task("本机")));
  const api = remote(document, 2);
  await store.sync(api);
  assert.ok(store.conflict);
  assert.equal(api.pushes, 0);
  assert.equal(store.state.tasks[0].title, "本机");
  await store.sync(api, "remote");
  assert.equal(store.state.tasks[0].title, "远端");
  const backup = [...wx.memory.entries()].find(([key]) =>
    key.includes(":backup:"),
  )[1];
  assert.equal(backup.local.tasks[0].title, "本机");
  assert.equal(backup.remote.tasks[0].title, "远端");
});
test("同步中新增任务仍标记为待同步，下一次上传不会丢失", async () => {
  const store = new Store(platform()).open({ id: "a" });
  store.mutate((s) => s.tasks.push(task("第一条")));
  const api = remote();
  const original = api.request.bind(api);
  api.request = async (p) => {
    if (p.action === "push") store.mutate((s) => s.tasks.push(task("第二条")));
    return original(p);
  };
  await store.sync(api);
  assert.equal(store.dirty, true);
  assert.equal(api.document.tasks.length, 1);
  api.request = original;
  await store.sync(api);
  assert.equal(store.dirty, false);
  assert.equal(api.document.tasks.length, 2);
});
test("选择保留本机后云端再次改变，要求重新核对", async () => {
  const store = new Store(platform()).open({ id: "a" }),
    api = remote(d.cloudDocument(d.initialState()), 1);
  store.mutate((s) => s.tasks.push(task()));
  await store.sync(api);
  api.version++;
  await store.sync(api, "local");
  assert.equal(api.pushes, 0);
  assert.equal(store.conflict.version, 2);
});
test("同步中退出账号，迟到响应不能写入另一账号", async () => {
  const store = new Store(platform()).open({ id: "a" }),
    api = remote(d.cloudDocument(d.initialState()), 1);
  let release;
  api.request = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const promise = store.sync(api);
  await new Promise((resolve) => setImmediate(resolve));
  store.open({ id: "b" });
  release({ document: api.document, version: 1 });
  await assert.rejects(promise, /会话已切换/);
  assert.equal(store.user.id, "b");
  assert.equal(store.version, 0);
});
test("存储失败回滚本次修改，损坏缓存保持原样", () => {
  const wx = platform(),
    store = new Store(wx).open({ id: "a" });
  wx.setStorageSync = () => {
    throw Error("空间不足");
  };
  assert.throws(() => store.mutate((s) => s.tasks.push(task())), /空间不足/);
  assert.equal(store.state.tasks.length, 0);
  assert.equal(store.dirty, false);
  wx.memory.set(recordKey({ id: "b" }), {
    version: 0,
    state: { schemaVersion: 999 },
  });
  assert.throws(() => store.open({ id: "b" }), /缓存异常/);
  assert.equal(store.user, null);
  assert.equal(wx.memory.get(recordKey({ id: "b" })).state.schemaVersion, 999);
});
test("回到前台只记录目标时长，重复 tick 不产生重复记录", () => {
  const wx = platform(),
    store = new Store(wx).open({ id: "a" }),
    start = Date.now();
  store.mutate(
    (s) => d.timerAction(s, "start", { durationMinutes: 25 }, start),
    false,
  );
  const restarted = new Store(wx).open({ id: "a" });
  restarted.tick(start + 60 * 60000);
  restarted.tick(start + 61 * 60000);
  assert.equal(restarted.state.logs.length, 1);
  assert.equal(restarted.state.logs[0].durationMs, 25 * 60000);
  assert.equal(restarted.dirty, true);
  assert.equal(restarted.state.timer.status, "idle");
});
test("暂停区间不计入专注，日志能通过桌面共享验证", () => {
  const store = new Store(platform()).open({ id: "a" }),
    start = Date.now();
  store.mutate(
    (s) => d.timerAction(s, "start", { durationMinutes: 25 }, start),
    false,
  );
  store.mutate((s) => d.timerAction(s, "pause", {}, start + 60000), false);
  store.mutate((s) => d.timerAction(s, "start", {}, start + 180000), false);
  store.mutate((s) => d.timerAction(s, "finish", {}, start + 240000));
  assert.equal(store.state.logs[0].durationMs, 120000);
  assert.equal(store.state.logs[0].segments.length, 2);
  assert.equal(
    d.validateCloudDocument(d.cloudDocument(store.state)).logs.length,
    1,
  );
});
test("重复任务完成逻辑复用桌面规则；删除标记可恢复", () => {
  const s = d.initialState();
  s.tasks.push(
    d.taskInput({
      title: "每日阅读",
      quadrant: "plan",
      repeat: "daily",
      due: d.dayKey(),
    }),
  );
  d.completeTask(s, s.tasks[0].id);
  d.completeTask(s, s.tasks[0].id);
  d.completeTask(s, s.tasks[0].id);
  assert.equal(s.tasks.length, 2);
  s.tasks[0].deletedAt = Date.now();
  assert.ok(d.validateCloudDocument(d.cloudDocument(s)).tasks[0].deletedAt);
});
test("课表覆盖未知不等同无课；跨日事件保持北京时间", () => {
  const s = d.initialState();
  assert.equal(d.courseCoverage(s, "2026-10-02").status, "missing");
  s.events.push(
    d.eventInput({
      title: "夜间安排",
      start: "2026-10-02T23:30",
      end: "2026-10-03T00:30",
    }),
  );
  const events = d.calendarEvents(s);
  assert.equal(d.eventsOnDay(events, "2026-10-03").length, 1);
});
test("非法服务地址、认证失效、迟到令牌均被拒绝", async () => {
  for (const origin of [
    "http://example.com",
    "https://122.51.44.155",
    "https://example.com/path",
    "https://user:pass@example.com",
  ])
    assert.throws(() => new Api({}, origin));
  const api = new Api(
    {
      request(p) {
        p.success({ statusCode: 401, data: { error: "UNAUTHENTICATED" } });
      },
    },
    "https://medstack.example",
  );
  api.token = "synthetic";
  let expired = false;
  api.onExpired = () => {
    expired = true;
  };
  await assert.rejects(api.request({ action: "pull" }));
  assert.equal(expired, true);
  assert.equal(api.token, null);
  let pending;
  const delayed = new Api(
    {
      request(p) {
        pending = p;
      },
    },
    "https://medstack.example",
  );
  const promise = delayed.login("synthetic@example.invalid", "Test123456");
  delayed.clear();
  pending.success({
    statusCode: 200,
    data: { user: { id: "a" } },
    header: { "set-auth-token": "synthetic" },
  });
  await assert.rejects(promise, /会话已切换/);
  assert.equal(delayed.token, null);
});
