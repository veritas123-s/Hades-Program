import test from "node:test";
import assert from "node:assert/strict";
import { TencentLogin } from "../electron/cloud/tencent-login.mjs";
import { TencentAPI } from "../electron/cloud/tencent-api.mjs";
import { CloudOnboarding } from "../electron/cloud/onboarding.mjs";
import { CloudSync } from "../electron/cloud-sync.mjs";
import { fakeCloud, memoryVault } from "./fixtures/cloud-provider.mjs";

async function loginFixture() {
  const provider = fakeCloud();
  let url;
  const login = new TencentLogin({
    openExternal: async (v) => {
      url = v;
    },
    fetcher: provider.fetcher,
  });
  await login.start();
  const auth = new URL(url),
    redirect = new URL(auth.searchParams.get("redirect_url"));
  const callback = new URL(redirect.searchParams.get("redirect_url"));
  callback.hostname = "127.0.0.1";
  callback.search = new URLSearchParams({
    access_token: "synthetic-access",
    state: auth.searchParams.get("state"),
    site: "cn",
  });
  return { ...provider, login, callback, auth };
}
test("腾讯云回调拒绝伪造 state；核验身份后才登录，凭据不进入状态", async () => {
  const f = await loginFixture();
  try {
    assert.equal(f.auth.origin, "https://cloud.tencent.com");
    assert.equal(f.login.status().authenticated, false);
    const invalid = new URL(f.callback);
    invalid.searchParams.set("state", "界".repeat(64));
    assert.equal((await fetch(invalid)).status, 400);
    assert.equal(f.state.calls.length, 0);
    assert.equal((await fetch(f.callback)).status, 200);
    assert.equal(f.login.status().authenticated, true);
    assert.equal(f.state.calls[0].action, "GetUserAppId");
    assert.doesNotMatch(
      JSON.stringify(f.login.status()),
      /synthetic-cloud|synthetic-access|secretKey|accessToken/,
    );
    f.login.logout();
    assert.equal(f.login.status().authenticated, false);
    assert.equal(f.login.credentials, null);
  } finally {
    f.login.stop();
  }
});
test("取消扫码后，旧回调不能恢复登录", async () => {
  const f = await loginFixture();
  f.login.logout();
  await assert.rejects(fetch(f.callback));
  assert.equal(f.login.status().authenticated, false);
});
function setup() {
  const provider = fakeCloud(),
    secrets = memoryVault();
  const credentials = {
    secretId: "synthetic-id",
    secretKey: "synthetic-secret",
    token: "synthetic-token",
    expiresAt: Date.now() / 1000 + 3600,
  };
  const login = {
    identity: provider.state.identity,
    status: () => ({ authenticated: true }),
    api: () => new TencentAPI(credentials, provider.fetcher),
    stop() {},
  };
  const sync = new CloudSync({
    secrets: memoryVault(),
    fetcher: provider.fetcher,
  });
  const options = {
    secrets,
    sync,
    login,
    getFeed: () => ({ generated_at: new Date().toISOString() }),
    openExternal: async () => {},
    pause: async () => {},
  };
  const cloud = new CloudOnboarding(options);
  cloud.bind({ token: "syntheticPushToken0123456789" });
  return { ...provider, cloud, secrets, sync, options, login };
}
test("邮件配置不暴露授权码；切换旧函数先保留版本再升级代码", async () => {
  const f = setup();
  try {
    await f.cloud.deploy({ consent: true });
    f.cloud.bind({
      channel: "email",
      email: {
        host: "smtp.qq.com",
        port: 465,
        user: "sender@example.com",
        to: "receiver@example.com",
        password: "synthetic-mail-only",
      },
    });
    assert.equal(f.cloud.status().channel, "email");
    assert.doesNotMatch(
      JSON.stringify(f.cloud.status()),
      /synthetic-mail-only/,
    );
    f.cloud.config.plan.runtimeHash = "legacy-runtime";
    const result = await f.cloud.deploy({ consent: true });
    assert.equal(result.phase, "ready", result.message);
    const actions = f.state.calls.map((x) => x.action);
    assert.ok(
      actions.indexOf("PublishVersion") < actions.indexOf("UpdateFunctionCode"),
    );
    const vars = Object.fromEntries(
      f.state.fn.Environment.Variables.map((x) => [x.Key, x.Value]),
    );
    assert.equal(vars.DELIVERY_CHANNEL, "email");
    assert.equal(vars.PUSHPLUS_TOKEN, undefined);
    assert.equal(f.state.testCount, 0);
  } finally {
    f.cloud.stop();
    f.sync.stop();
  }
});
test("费用未确认不创建资源；完整部署只授予单对象权限，不自动发送测试", async () => {
  const f = setup();
  try {
    await assert.rejects(f.cloud.deploy({}), /确认/);
    assert.equal(f.state.calls.length, 0);
    const result = await f.cloud.deploy({ consent: true });
    assert.equal(result.phase, "ready", result.message);
    assert.ok(result.plan.completedAt);
    assert.equal(f.state.testCount, 0);
    assert.equal(result.receivedAt, null);
    const policy = JSON.parse(f.state.policy.PolicyDocument).statement[0];
    assert.deepEqual(policy.action, [
      "name/cos:GetObject",
      "name/cos:PutObject",
    ]);
    assert.equal(policy.resource.length, 1);
    assert.ok(policy.resource[0].endsWith("/veritas/veritas-feed.json"));
    assert.ok(!policy.resource[0].includes("*"));
    assert.equal(
      f.state.fn.Triggers.filter((t) => t.Type === "timer").length,
      2,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /syntheticPush|synthetic-secret|synthetic-token/,
    );
    assert.doesNotMatch(
      JSON.stringify(f.secrets.data),
      /synthetic-secret|synthetic-token/,
    );
    assert.throws(() => f.cloud.confirmReceived(), /实际收到/);
    await f.cloud.testMessage();
    assert.equal(f.state.testCount, 1);
    assert.equal(f.cloud.status().receivedAt, null);
    await assert.rejects(f.cloud.testMessage(), /一分钟/);
    f.cloud.confirmReceived();
    assert.ok(f.cloud.status().receivedAt);
  } finally {
    f.sync.stop();
  }
});
test("失败后保留计划，重启继续不重建资源，拒绝换错账号", async () => {
  const f = setup();
  try {
    f.state.failAction = "CreateFunction";
    const first = await f.cloud.deploy({ consent: true });
    assert.equal(first.phase, "error");
    assert.equal(first.plan.completedAt, null);
    assert.doesNotMatch(first.message, /DO_NOT_LEAK/);
    const old = f.cloud.status().plan.bucket;
    f.state.failAction = "";
    const resumed = new CloudOnboarding(f.options);
    const final = await resumed.deploy({ consent: true });
    assert.equal(final.phase, "ready", final.message);
    assert.equal(final.plan.bucket, old);
    assert.equal(
      f.state.calls.filter((c) => c.action === "CreateRole").length,
      1,
    );
    assert.equal(
      f.state.calls.filter((c) => c.action === "CreatePolicy").length,
      1,
    );
    const before = f.state.calls.length;
    f.login.identity = { AppId: 1250000001, OwnerUin: "100000000002" };
    await assert.rejects(resumed.deploy({ consent: true }), /不一致/);
    assert.equal(f.state.calls.length, before);
  } finally {
    f.sync.stop();
  }
});
test("公开存储、首次同步失败或云端摘要不一致均不能显示完成", async () => {
  for (const failure of ["publicBucket", "sync", "badHealth"]) {
    const f = setup();
    try {
      if (failure === "sync") f.state.failAction = "sync";
      else f.state[failure] = true;
      const result = await f.cloud.deploy({ consent: true });
      assert.equal(result.phase, "error", failure);
      assert.equal(result.plan.completedAt, null);
      assert.equal(
        f.state.fn?.Triggers.filter((t) => t.Type === "timer").length || 0,
        0,
      );
    } finally {
      f.sync.stop();
    }
  }
});
test("已有手动通道不会被开通向导覆盖，换端点必须换密钥", async () => {
  const f = setup();
  try {
    f.sync.configure({
      url: "https://existing.ap-shanghai.tencentscf.com/veritas-sync",
      secret: "a".repeat(64),
    });
    await assert.rejects(f.cloud.deploy({ consent: true }), /另一条/);
    assert.throws(
      () =>
        f.sync.configure({
          url: "https://new.ap-shanghai.tencentscf.com/veritas-sync",
        }),
      /自己的密钥/,
    );
    assert.equal(f.state.calls.length, 0);
  } finally {
    f.sync.stop();
  }
});
