import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  MailService,
  mailUsername,
  SJTU_IMAP,
} from "../electron/mail-service.mjs";
import execute from "../electron/commands/mail.mjs";
import { requireAccount } from "../electron/accounts/access.mjs";
import { taskInput } from "../src/domain/tasks.mjs";
const source = Buffer.from(
  "From: campus@example.invalid\r\nSubject: =?UTF-8?B?5ZCI5oiQ6YCa55+l?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n合成正文 <script>invalid()</script>",
);
function fixture() {
  let owner = "synthetic-a",
    options;
  const calls = [];
  class Client extends EventEmitter {
    mailbox = { exists: 220, uidValidity: 123n, readOnly: true };
    async connect() {}
    async getMailboxLock(path, options) {
      calls.push({ path, options });
      return { release() {} };
    }
    async status() {
      return { unseen: 5 };
    }
    async *fetch(range) {
      calls.push({ range });
      yield {
        uid: 220,
        envelope: {
          subject: "合成通知",
          from: [{ address: "campus@example.invalid" }],
          date: new Date(0),
        },
        flags: new Set(),
        size: source.length,
      };
    }
    async fetchOne(uid, query, options) {
      calls.push({ uid, query, options });
      return query.source ? { source } : { size: source.length };
    }
    close() {
      calls.push({ closed: true });
    }
  }
  const clients = [];
  const mail = new MailService({
    owner: () => owner,
    clientFactory: (opt) => {
      options = opt;
      const client = new Client();
      clients.push(client);
      return client;
    },
  });
  return {
    mail,
    calls,
    clients,
    setOwner: (value) => (owner = value),
    options: () => options,
  };
}
test("交大账号格式及未登录邮件命令门禁", () => {
  assert.equal(mailUsername("abc@sjtu.edu.cn"), "abc");
  assert.throws(() => mailUsername("abc@other.invalid"));
  for (const action of [
    "mail.state",
    "mail.connect",
    "mail.read",
    "mail.refresh",
    "mail.disconnect",
    "mail.task",
  ])
    assert.throws(() => requireAccount({ authenticated: false }, action));
});
test("固定TLS端点、只读INBOX、最近200封、密码不出现在快照", async () => {
  const f = fixture();
  const state = await f.mail.connect({
    username: "abc",
    password: "synthetic-secret",
  });
  assert.equal(f.options().host, SJTU_IMAP.host);
  assert.equal(f.options().secure, true);
  assert.equal(f.options().tls.rejectUnauthorized, true);
  assert.equal(f.options().logger, false);
  assert.deepEqual(f.calls[0], { path: "INBOX", options: { readOnly: true } });
  assert.equal(f.calls[1].range, "21:220");
  assert.equal(state.unread, 5);
  assert.equal(state.items[0].unread, true);
  assert(!JSON.stringify(state).includes("synthetic-secret"));
});
test("中文MIME解析、有限源读取与纯文本返回", async () => {
  const f = fixture();
  await f.mail.connect({ username: "abc", password: "synthetic-secret" });
  const result = await f.mail.read({ uid: 220, validity: "123" });
  assert.match(result.text, /合成正文/);
  assert.equal(result.html, undefined);
  assert.equal(result.attachments.length, 0);
  const fetch = f.calls.find((x) => x.query?.source);
  assert(fetch.query.source.maxLength <= 10 * 1024 * 1024 + 1);
  assert.equal(fetch.options.uid, true);
});
test("断开及跨账号清除邮件和密码", async () => {
  const f = fixture();
  await f.mail.connect({ username: "abc", password: "synthetic-secret" });
  f.setOwner("synthetic-b");
  assert.equal(f.mail.status().connected, false);
  assert.deepEqual(f.mail.status().items, []);
  assert.equal(f.mail.credentials, null);
  await assert.rejects(f.mail.refresh());
});
test("账号在网络响应期间退出时丢弃结果并关闭连接", async () => {
  const f = fixture();
  await f.mail.connect({ username: "abc", password: "synthetic-secret" });
  const create = f.mail.clientFactory;
  f.mail.clientFactory = (options) => {
    const client = create(options);
    client.status = async () => {
      f.setOwner(null);
      return { unseen: 1 };
    };
    return client;
  };
  await assert.rejects(f.mail.refresh(), /邮箱会话已结束/);
  assert.equal(f.mail.status().connected, false);
  assert.equal(f.mail.credentials, null);
});
test("认证失败不暴露协议错误或凭据", async () => {
  const f = fixture();
  const create = f.mail.clientFactory;
  f.mail.clientFactory = (options) => {
    const client = create(options);
    client.connect = async () => {
      throw Object.assign(Error("LOGIN synthetic-secret"), {
        authenticationFailed: true,
      });
    };
    return client;
  };
  await assert.rejects(
    f.mail.connect({ username: "abc", password: "synthetic-secret" }),
    (error) =>
      /认证失败/.test(error.message) &&
      !error.message.includes("synthetic-secret"),
  );
  assert.equal(f.mail.credentials, null);
});
test("UIDVALIDITY变化、超大邮件与不完整响应拒绝读取", async () => {
  for (const [scenario, expected] of [
    ["validity", /收件箱已改变/],
    ["size", /超过 10 MB/],
    ["partial", /不完整/],
  ]) {
    const f = fixture();
    await f.mail.connect({ username: "abc", password: "synthetic-secret" });
    const create = f.mail.clientFactory;
    f.mail.clientFactory = (options) => {
      const client = create(options);
      if (scenario === "validity") client.mailbox.uidValidity = 124n;
      else
        client.fetchOne = async (_, query) =>
          query.source
            ? { source: source.subarray(0, 10) }
            : { size: scenario === "size" ? 20 * 1024 * 1024 : source.length };
      return client;
    };
    await assert.rejects(f.mail.read({ uid: 220, validity: "123" }), expected);
  }
});
test("显式转为待办、重复点击不重复创建、邮箱切换不误去重", async () => {
  const f = fixture();
  await f.mail.connect({ username: "abc", password: "synthetic-secret" });
  const store = { state: { tasks: [] }, change: (fn) => fn(store.state) };
  const context = {
    mail: f.mail,
    store,
    domain: { taskInput },
    broadcast() {},
  };
  const payload = { uid: 220, validity: "123" };
  assert.equal((await execute("mail.task", payload, context)).existing, false);
  assert.equal((await execute("mail.task", payload, context)).existing, true);
  assert.equal(store.state.tasks.length, 1);
  assert(!store.state.tasks[0].notes.includes("合成正文"));
  await f.mail.connect({ username: "other", password: "synthetic-secret" });
  await execute("mail.task", payload, context);
  assert.equal(store.state.tasks.length, 2);
});
