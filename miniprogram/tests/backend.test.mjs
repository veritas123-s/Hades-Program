import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createBackend } from "../../server/backend.mjs";
import { validateCloudDocument } from "../../src/cloud-data.mjs";
const require = createRequire(import.meta.url);
const { Api } = require("../lib/api");
const { Store } = require("../lib/store");
const d = require("../lib/domain");
test("真实本地后台：小程序请求适配、邮箱登录、账号隔离和共享文档互通", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-mp-")),
    outbox = [],
    origin = "https://medstack.example";
  const backend = await createBackend({
    database: path.join(directory, "test.sqlite"),
    baseURL: origin,
    secret: "synthetic-only-mini-program-test-secret-000000",
    testMode: true,
    sendEmail: async (message) => outbox.push(message),
  });
  const memory = new Map();
  const wx = {
    getStorageSync: (key) => memory.get(key),
    setStorageSync: (key, value) => memory.set(key, structuredClone(value)),
    request(p) {
      backend
        .handle(
          new Request(p.url, {
            method: p.method,
            headers: p.header,
            ...(p.data === undefined ? {} : { body: JSON.stringify(p.data) }),
          }),
        )
        .then(async (response) =>
          p.success({
            statusCode: response.status,
            header: Object.fromEntries(response.headers),
            data: await response.json(),
          }),
        )
        .catch(p.fail);
    },
  };
  const api = new Api(wx, origin),
    password = "Synthetic123!Test";
  async function signup(email) {
    await api.call("/api/auth/sign-up/email", {
      email,
      password,
      name: "合成账号",
    });
    const otp = outbox.filter((m) => m.email === email).at(-1).otp;
    await api.call("/api/auth/email-otp/verify-email", { email, otp });
    return api.login(email, password);
  }
  try {
    const first = await signup("mini-a@synthetic.invalid"),
      store = new Store(wx).open(first);
    store.mutate((s) =>
      s.tasks.push(d.taskInput({ title: "跨端合成任务", quadrant: "plan" })),
    );
    await store.sync(api);
    assert.equal(store.version, 1);
    assert.equal(store.dirty, false);
    const pulled = await api.request({ action: "pull" });
    assert.equal(
      validateCloudDocument(pulled.document).tasks[0].title,
      "跨端合成任务",
    );
    const second = await signup("mini-b@synthetic.invalid");
    store.open(second);
    assert.equal((await api.request({ action: "pull" })).document, null);
    assert.equal(store.state.tasks.length, 0);
    assert.ok(!JSON.stringify([...memory]).includes("Synthetic123"));
    assert.ok(!JSON.stringify([...memory]).includes(api.token));
    await api.call("/api/auth/sign-out", {}, true);
    await assert.rejects(api.request({ action: "pull" }));
    assert.equal(api.token, null);
  } finally {
    backend.close();
  }
});
