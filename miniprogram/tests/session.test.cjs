const test = require("node:test");
const assert = require("node:assert/strict");
const { Api } = require("../lib/api");
test("后台返回空会话时立即清除登录，不继续展示个人工作区", async () => {
  const api = new Api(
    {
      request(p) {
        p.success({ statusCode: 200, data: null });
      },
    },
    "https://medstack.example",
  );
  api.token = "synthetic-only-session";
  let locked = false;
  api.onExpired = () => {
    locked = true;
  };
  await assert.rejects(
    api.call("/api/auth/get-session", undefined, true),
    /登录已过期/,
  );
  assert.equal(locked, true);
  assert.equal(api.token, null);
});
