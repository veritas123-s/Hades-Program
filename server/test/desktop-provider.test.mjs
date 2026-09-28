import test from "node:test";
import assert from "node:assert/strict";
import { createBackend } from "../backend.mjs";
import { SelfHostedProvider } from "../../electron/accounts/self-hosted.mjs";
import { cloudDocument } from "../../src/cloud-data.mjs";
import { initialState } from "../../src/domain.mjs";

test("桌面端真实账号流程、加密仓库边界、跨地址会话隔离与密码找回", async () => {
  const outbox = [],
    saved = {};
  const backend = await createBackend({
    database: ":memory:",
    baseURL: "https://hades.synthetic.invalid",
    secret: "synthetic-secret-for-tests-not-production-1234",
    testMode: true,
    sendEmail: async (m) => outbox.push(m),
  });
  const secrets = {
    load: () => structuredClone(saved),
    save: (p) => Object.assign(saved, structuredClone(p)),
  };
  const fetcher = (url, options) => backend.handle(new Request(url, options));
  const p = new SelfHostedProvider(
    { baseURL: "https://hades.synthetic.invalid" },
    secrets,
    { fetcher },
  );
  try {
    assert.equal(await p.initialize(), null);
    await p.send(
      "desktop@synthetic.invalid",
      "register",
      "SyntheticPassword123!",
    );
    assert.equal(
      JSON.stringify(p.pending).includes("SyntheticPassword"),
      false,
    );
    await assert.rejects(() =>
      p.login("desktop@synthetic.invalid", "SyntheticPassword123!"),
    );
    const user = await p.verify(outbox.at(-1).otp);
    assert.ok(user.id);
    assert.equal(user.email, "desktop@synthetic.invalid");
    assert.ok(saved.tokens.token);
    assert.equal(JSON.stringify(saved).includes("SyntheticPassword"), false);
    assert.equal((await p.nickname("合成测试")).nickname, "合成测试");
    assert.equal(
      (
        await p.request({
          action: "push",
          version: 0,
          document: cloudDocument(initialState()),
        })
      ).version,
      1,
    );
    const resumed = new SelfHostedProvider(p.config, secrets, { fetcher });
    assert.equal((await resumed.initialize()).id, user.id);
    const foreign = new SelfHostedProvider(
      { baseURL: "https://another.synthetic.invalid" },
      secrets,
      {
        fetcher: () => {
          throw Error("must not transmit token");
        },
      },
    );
    assert.equal(await foreign.initialize(), null);
    await p.send(user.email, "reset");
    await p.verify(outbox.at(-1).otp, "NewSyntheticPassword123!");
    await assert.rejects(() => resumed.current());
    assert.equal((await p.request({ action: "pull" })).version, 1);
    await p.logout();
    assert.equal(saved.tokens, null);
    await assert.rejects(() => p.current());
    assert.throws(
      () => new SelfHostedProvider({ baseURL: "http://example.com" }, secrets),
    );
  } finally {
    backend.close();
  }
});
