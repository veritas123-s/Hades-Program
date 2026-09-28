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
  // Reproduce metadata added by the real Electron/Node network stack, which a
  // directly constructed Request in the old fixture did not include.
  const fetcher = (url, options) =>
    backend.handle(
      new Request(url, {
        ...options,
        headers: {
          ...options.headers,
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "none",
          "sec-fetch-dest": "empty",
        },
      }),
    );
  const p = new SelfHostedProvider(
    { baseURL: "https://hades.synthetic.invalid" },
    secrets,
    { fetcher },
  );
  try {
    const missingOrigin = await backend.handle(
      new Request(
        "https://hades.synthetic.invalid/api/auth/email-otp/send-verification-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "sec-fetch-mode": "cors",
          },
          body: JSON.stringify({
            email: "not-created@synthetic.invalid",
            type: "email-verification",
          }),
        },
      ),
    );
    assert.equal(missingOrigin.status, 403);
    assert.equal((await missingOrigin.json()).code, "MISSING_OR_NULL_ORIGIN");
    const foreignOrigin = await backend.handle(
      new Request(
        "https://hades.synthetic.invalid/api/auth/email-otp/send-verification-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://untrusted.invalid",
            "sec-fetch-mode": "cors",
          },
          body: JSON.stringify({
            email: "not-created@synthetic.invalid",
            type: "email-verification",
          }),
        },
      ),
    );
    assert.equal(foreignOrigin.status, 403);
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
    const firstCode = outbox.at(-1).otp;
    await p.resend("desktop@synthetic.invalid", "register");
    assert.equal(outbox.length, 2);
    if (firstCode !== outbox.at(-1).otp)
      await assert.rejects(() => p.verify(firstCode));
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

test("首次发信失败后，账号可重发验证码完成验证，密码不进入客户端待处理状态", async () => {
  let fail = true;
  const outbox = [];
  const backend = await createBackend({
    database: ":memory:",
    baseURL: "https://retry.synthetic.invalid",
    secret: "synthetic-secret-for-tests-not-production-5678",
    testMode: true,
    sendEmail: async (m) => {
      if (fail) throw Error("synthetic SMTP unavailable");
      outbox.push(m);
    },
  });
  const saved = {};
  const p = new SelfHostedProvider(
    { baseURL: "https://retry.synthetic.invalid" },
    { load: () => saved, save: (v) => Object.assign(saved, v) },
    { fetcher: (u, o) => backend.handle(new Request(u, o)) },
  );
  try {
    await assert.rejects(() =>
      p.send("retry@synthetic.invalid", "register", "SyntheticPassword123!"),
    );
    assert.equal(p.pending.kind, "register");
    assert.equal(p.pending.password, undefined);
    fail = false;
    await p.resend("retry@synthetic.invalid", "register");
    assert.equal(outbox.length, 1);
    const user = await p.verify(outbox[0].otp);
    assert.equal(user.email, "retry@synthetic.invalid");
  } finally {
    backend.close();
  }
});
