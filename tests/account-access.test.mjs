import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  requireAccount,
  lockedSnapshot,
} from "../electron/accounts/access.mjs";
import { Accounts } from "../electron/accounts/service.mjs";
import { AccountProfiles } from "../electron/accounts/profiles.mjs";
import { SelfHostedProvider } from "../electron/accounts/self-hosted.mjs";
import { initialState } from "../src/domain.mjs";
const secrets = () => ({
  data: {},
  load() {
    return this.data;
  },
  save(p) {
    Object.assign(this.data, p);
  },
});
test("未登录的状态不包含旧账号身份和个人摘要，所有个人命令默认拒绝", async () => {
  let started = false;
  const a = new Accounts({
    profiles: { active: { id: "A", email: "private@synthetic.invalid" } },
    provider: { available: true, initialize: async () => null },
    store: { state: initialState() },
    sync: {
      start() {
        started = true;
      },
      stop() {},
    },
    changed() {},
  });
  await a.initialize();
  assert.equal(started, false);
  const s = lockedSnapshot(a.status(), 1);
  assert.equal(s.account.user, null);
  assert.equal(s.account.localSummary, null);
  assert.equal(s.account.sync, null);
  assert.equal(JSON.stringify(s).includes("private@"), false);
  assert.deepEqual(Object.keys(s), [
    "schemaVersion",
    "locked",
    "account",
    "revision",
  ]);
  for (const action of [
    "assistant.state",
    "assistant.configure",
    "tasks.add",
    "state.export",
    "campus.sync",
    "workspace.configure",
    "briefing.state",
    "account.sync",
    "account.logout",
    "unknown.future.module",
  ])
    assert.throws(() => requireAccount(a, action), /登录/);
  await assert.rejects(() => a.execute("account.sync"), /登录/);
  for (const action of [
    "account.login",
    "account.send",
    "account.verify",
    "state",
  ])
    requireAccount(a, action);
});
test("旧本机数据及加密配置只可归入一个账号，不覆盖、不删除，不复制账号令牌", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-access-")),
    vault = secrets(),
    p = new AccountProfiles(dir, vault);
  fs.writeFileSync(
    path.join(dir, "assistant-vault.bin"),
    "synthetic-ciphertext",
  );
  fs.writeFileSync(path.join(dir, "account-vault.bin"), "must-not-copy");
  fs.mkdirSync(path.join(dir, "theme-backgrounds"));
  fs.writeFileSync(
    path.join(dir, "theme-backgrounds", "synthetic.png"),
    "synthetic",
  );
  const seed = initialState();
  seed.timer.status = "paused";
  seed.timer.segments = [{ start: 1000, end: 3000 }];
  const dest = p.prepare({ id: "A" }, seed);
  assert.equal(
    fs.readFileSync(path.join(dest, "assistant-vault.bin"), "utf8"),
    "synthetic-ciphertext",
  );
  assert.equal(fs.existsSync(path.join(dest, "account-vault.bin")), false);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(dest, "veritas-data.json"))).timer
      .segments,
    seed.timer.segments,
  );
  assert.ok(fs.existsSync(path.join(dir, "assistant-vault.bin")));
  p.select(null);
  assert.equal(p.canImportLegacy({ id: "B" }), false);
  assert.throws(() => p.prepare({ id: "B" }, seed));
});
test("账号网络等待覆盖慢请求和停滞响应体，取消后不保存迟到的令牌", async () => {
  const vault = secrets();
  let finish;
  const p = new SelfHostedProvider(
    { baseURL: "https://synthetic.invalid" },
    vault,
    {
      timeoutMs: 30,
      mailTimeoutMs: 30,
      fetcher: () => new Promise((r) => (finish = r)),
    },
  );
  await assert.rejects(
    () => p.send("a@synthetic.invalid", "register", "Synthetic123"),
    /超时/,
  );
  assert.equal(p.pending.kind, "register");
  finish(
    Response.json(
      { user: { id: "late" } },
      { headers: { "set-auth-token": "late-token" } },
    ),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(vault.data.tokens, undefined);
  p.fetcher = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("{"));
        },
      }),
    );
  await assert.rejects(() => p.current(), /登录/);
  await assert.rejects(() => p.call("/health"), /超时/);
  p.fetcher = () => new Promise(() => {});
  const wait = p.call("/health");
  p.cancel();
  await assert.rejects(() => wait, /停止等待/);
});
test("服务器撤销会话或返回空会话会锁定，普通网络故障不会清除已保存凭据", async () => {
  const vault = secrets();
  let locks = 0;
  const p = new SelfHostedProvider(
    { baseURL: "https://synthetic.invalid" },
    vault,
    { fetcher: async () => Response.json(null) },
  );
  p.token = "synthetic";
  p.onInvalidSession = () => locks++;
  await assert.rejects(() => p.current(), /过期/);
  assert.equal(locks, 1);
  assert.equal(p.token, null);
  p.token = "synthetic";
  p.fetcher = async () =>
    Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  await assert.rejects(() => p.request({ action: "pull" }));
  assert.equal(locks, 2);
});
