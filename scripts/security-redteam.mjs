import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createBackend } from "../server/backend.mjs";
import { cloudDocument } from "../src/cloud-data.mjs";
import { initialState, taskInput } from "../src/domain.mjs";

const origin = "https://medstack.redteam.invalid";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-redteam-"));
const outbox = [];
const results = [];
const record = async (name, run) => {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
};

const backend = await createBackend({
  database: path.join(directory, "redteam.sqlite"),
  baseURL: origin,
  secret: "synthetic-redteam-secret-never-production-0001",
  testMode: true,
  sendEmail: async (message) => outbox.push(message),
});

async function request(route, body, token, requestOrigin = origin, raw) {
  const response = await backend.handle(
    new Request(origin + route, {
      method: body === undefined && raw === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(requestOrigin === null ? {} : { Origin: requestOrigin }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined && raw === undefined
        ? {}
        : { body: raw === undefined ? JSON.stringify(body) : raw }),
    }),
  );
  const text = await response.text();
  return {
    response,
    text,
    data: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    })(),
  };
}

async function signup(email) {
  await request("/api/auth/sign-up/email", {
    email,
    password: "SyntheticSecurity123!",
    name: "合成安全用户",
  });
  const otp = outbox.filter((item) => item.email === email).at(-1)?.otp;
  assert.ok(otp);
  const verified = await request("/api/auth/email-otp/verify-email", {
    email,
    otp,
  });
  const token = verified.response.headers.get("set-auth-token");
  assert.ok(token);
  return token;
}

try {
  await record("认证接口拒绝缺失 Origin", async () => {
    const result = await request(
      "/api/auth/email-otp/send-verification-otp",
      { email: "missing@synthetic.invalid", type: "email-verification" },
      null,
      null,
    );
    assert.equal(result.response.status, 403);
  });
  await record("认证接口拒绝外站 Origin", async () => {
    const result = await request(
      "/api/auth/email-otp/send-verification-otp",
      { email: "foreign@synthetic.invalid", type: "email-verification" },
      null,
      "https://attacker.invalid",
    );
    assert.equal(result.response.status, 403);
  });

  const first = await signup("first@synthetic.invalid");
  const second = await signup("second@synthetic.invalid");

  await record("同步接口拒绝未认证请求", async () => {
    assert.equal(
      (await request("/api/sync", { action: "pull" })).response.status,
      401,
    );
  });
  await record("同步接口拒绝外站 Origin", async () => {
    assert.equal(
      (
        await request(
          "/api/sync",
          { action: "pull" },
          first,
          "https://attacker.invalid",
        )
      ).response.status,
      403,
    );
  });
  await record("畸形 JSON 不触发堆栈或服务端细节泄露", async () => {
    const result = await request(
      "/api/sync",
      undefined,
      first,
      origin,
      '{"action":',
    );
    assert.equal(result.response.status, 400);
    assert.equal(/stack|sqlite|secret/i.test(result.text), false);
  });
  await record("原型字段与伪造用户字段被拒绝", async () => {
    const prototype = await request(
      "/api/sync",
      JSON.parse('{"action":"pull","__proto__":{"admin":true}}'),
      first,
    );
    const uid = await request(
      "/api/sync",
      { action: "pull", uid: "second" },
      first,
    );
    assert.equal(prototype.response.status, 400);
    assert.equal(uid.response.status, 400);
  });

  const document = cloudDocument(initialState());
  document.tasks.push(
    taskInput({
      title: "'); DROP TABLE medstack_snapshots; --",
      quadrant: "plan",
      project: "收集箱",
    }),
  );
  await record("SQL 注入样式文本按普通内容保存", async () => {
    assert.equal(
      (
        await request(
          "/api/sync",
          { action: "push", version: 0, document },
          first,
        )
      ).data.version,
      1,
    );
    const pulled = await request("/api/sync", { action: "pull" }, first);
    assert.equal(
      pulled.data.document.tasks[0].title,
      "'); DROP TABLE medstack_snapshots; --",
    );
  });
  await record("账号之间的数据严格隔离", async () => {
    const pulled = await request("/api/sync", { action: "pull" }, second);
    assert.equal(pulled.data.document, null);
  });
  await record("旧版本重放不能覆盖较新快照", async () => {
    const replay = await request(
      "/api/sync",
      { action: "push", version: 0, document },
      first,
    );
    assert.equal(replay.data.conflict, true);
    assert.equal(replay.data.version, 1);
  });
  await record("安全响应头阻止缓存、嵌入与内容嗅探", async () => {
    const response = (await request("/api/sync", { action: "pull" }, first))
      .response;
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(
      response.headers.get("content-security-policy") || "",
      /default-src 'none'/,
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
  await record("错误响应不回显会话令牌", async () => {
    const result = await request("/api/sync", { action: "invalid" }, first);
    assert.equal(result.text.includes(first), false);
  });
  await record("安卓清单禁用明文网络与系统备份", async () => {
    const manifest = fs.readFileSync(
      "android/app/src/main/AndroidManifest.xml",
      "utf8",
    );
    const network = fs.readFileSync(
      "android/app/src/main/res/xml/network_security_config.xml",
      "utf8",
    );
    assert.match(manifest, /android:allowBackup="false"/);
    assert.match(manifest, /android:usesCleartextTraffic="false"/);
    assert.match(network, /cleartextTrafficPermitted="false"/);
    assert.match(manifest, /android:networkSecurityConfig=/);
  });
  await record("安卓会话与缓存通过 KeyStore 加密", async () => {
    const source = fs.readFileSync(
      "android/app/src/main/java/com/shsmuveritas/medstack/security/SecureStore.kt",
      "utf8",
    );
    assert.match(source, /AndroidKeyStore/);
    assert.match(source, /AES\/GCM\/NoPadding/);
    assert.equal(/Log\.|println\(/.test(source), false);
  });
  await record("受版本控制源码未包含高置信度 API 密钥", async () => {
    const files = execFileSync(
      "git",
      ["ls-files", "src", "electron", "server", "android"],
      {
        encoding: "utf8",
      },
    )
      .split(/\r?\n/)
      .filter(Boolean);
    const findings = files.filter((file) => {
      const content = fs.readFileSync(file, "utf8");
      return (
        /sk-[A-Za-z0-9_-]{20,}/.test(content) ||
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)
      );
    });
    assert.deepEqual(findings, []);
  });
} finally {
  backend.close();
  fs.rmSync(directory, { recursive: true, force: true });
}

const report = {
  version: "3.2.0",
  generatedAt: new Date().toISOString(),
  scope: "isolated synthetic backend and static client controls",
  productionTraffic: false,
  passed: results.filter((item) => item.passed).length,
  total: results.length,
  results,
};
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync(
  "test-results/security-redteam-v3.2.json",
  JSON.stringify(report, null, 2),
);
console.log(
  `Medstack V3.2 security exercise: ${report.passed}/${report.total} passed`,
);
for (const item of results.filter((entry) => !entry.passed))
  console.error(`FAIL ${item.name}: ${item.error}`);
if (report.passed !== report.total) process.exitCode = 1;
