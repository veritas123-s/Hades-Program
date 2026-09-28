import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { apiBase } from "../electron/assistant-connection.mjs";
import { AssistantService } from "../electron/assistant-service.mjs";
import { initialState } from "../src/domain.mjs";

function setup(fetcher) {
  const secrets = {
    data: { key: "original-school-key", model: "deepseek-chat" },
    protection: { isEncryptionAvailable: () => true },
    save(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  const service = new AssistantService({
    directory: fs.mkdtempSync(path.join(os.tmpdir(), "veritas-connection-")),
    secrets,
    fetcher,
  });
  return { service, secrets };
}
test("自定义 Base URL 保留路径，拒绝凭据、查询参数、远程明文和完整调用路径", () => {
  assert.equal(
    apiBase(" https://provider.example/compatible/v1/// "),
    "https://provider.example/compatible/v1",
  );
  assert.equal(
    apiBase("http://localhost:11434/v1"),
    "http://localhost:11434/v1",
  );
  for (const value of [
    "file:///tmp",
    "http://provider.example/v1",
    "https://user:key@provider.example/v1",
    "https://provider.example/v1?key=secret",
    "https://provider.example/v1#key",
    "https://provider.example/v1/chat/completions",
    "https://provider.example/v1/models",
  ])
    assert.throws(() => apiBase(value));
});
test("切换服务必须显式提供新密钥，原学校密钥不会自动发送到新服务", async () => {
  const requests = [];
  const { service, secrets } = setup(async (url, options) => {
    requests.push({ url, options });
    return Response.json({
      choices: [{ message: { content: '{"reply":"完成","tasks":[]}' } }],
    });
  });
  assert.throws(
    () =>
      service.configure({
        endpoint: "https://provider.example/v1",
        model: "org/model",
      }),
    /该服务自己的密钥/,
  );
  assert.equal(secrets.data.key, "original-school-key");
  service.configure({
    endpoint: "https://provider.example/v1/",
    key: "replacement-provider-key",
    model: "org/model:free",
  });
  await service.chat(
    { text: "合成输入", includeContext: false },
    initialState(),
  );
  assert.equal(requests[0].url, "https://provider.example/v1/chat/completions");
  assert.equal(
    requests[0].options.headers.Authorization,
    "Bearer replacement-provider-key",
  );
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(JSON.parse(requests[0].options.body).model, "org/model:free");
  assert.doesNotMatch(
    JSON.stringify(service.status()),
    /original-school-key|replacement-provider-key/,
  );
  service.configure({
    endpoint: "https://provider.example/v1",
    key: "",
    model: "org/next",
  });
  assert.equal(secrets.data.key, "replacement-provider-key");
});
test("缺少模型列表的服务仍可手填调用，错误不会暴露上游密钥", async () => {
  const { service } = setup(async (url) =>
    url.endsWith("/models")
      ? new Response("upstream-secret-diagnostic", { status: 404 })
      : Response.json({
          choices: [{ message: { content: "手工模型调用成功" } }],
        }),
  );
  service.configure({
    endpoint: "https://provider.example/v1",
    key: "own-key",
    model: "manual-model",
  });
  await assert.rejects(
    () => service.models(),
    (error) =>
      /手动填写/.test(error.message) &&
      !error.message.includes("upstream-secret"),
  );
  await service.chat({ text: "测试" }, initialState());
  assert.equal(service.history.length, 1);
});
test("切换服务清除旧模型列表，刷新不会替换已填写的自定义模型", async () => {
  const { service, secrets } = setup(async () =>
    Response.json({ data: [{ id: "listed-model" }] }),
  );
  secrets.data.models = ["old-school-model"];
  service.configure({
    endpoint: "https://provider.example/v1",
    key: "own-key",
  });
  assert.deepEqual(service.status().models, []);
  await assert.rejects(
    () => service.chat({ text: "测试" }, initialState()),
    /填写模型名称/,
  );
  await service.models();
  assert.equal(service.status().model, "listed-model");
  service.configure({ model: "org/custom" });
  await service.models();
  assert.equal(service.status().model, "org/custom");
});
