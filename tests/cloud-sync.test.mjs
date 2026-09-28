import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { CloudSync, syncURL, signedHeaders } from "../electron/cloud-sync.mjs";
const secret = "a".repeat(64),
  url = "https://synthetic.ap-shanghai.tencentscf.com/veritas-sync";
const vault = () => ({
  data: { url, secret },
  load() {
    return this.data;
  },
  save(v) {
    this.data = v;
  },
  clear() {
    this.data = {};
  },
});
const ack = (body) =>
  Response.json({
    status: "stored",
    sha256: createHash("sha256").update(body).digest("hex"),
    generated_at: JSON.parse(body).generated_at,
  });
test("同步仅允许指定云端 HTTPS 路径，签名包含正文、时间与随机数", () => {
  for (const bad of [
    "http://synthetic.ap-shanghai.tencentscf.com/veritas-sync",
    "https://evil.example/veritas-sync",
    url + "?secret=x",
    url + "/other",
    "https://u:p@synthetic.ap-shanghai.tencentscf.com/veritas-sync",
  ])
    assert.throws(() => syncURL(bad));
  assert.equal(syncURL(url), url);
  const a = signedHeaders(secret, "POST", "/veritas-sync", "{}", 1000),
    b = signedHeaders(secret, "POST", "/veritas-sync", "{}", 1000);
  assert.notEqual(a["X-Veritas-Nonce"], b["X-Veritas-Nonce"]);
  const expected = createHmac("sha256", secret)
    .update(
      [
        "1",
        a["X-Veritas-Nonce"],
        "POST",
        "/veritas-sync",
        createHash("sha256").update("{}").digest("hex"),
      ].join("\n"),
    )
    .digest("hex");
  assert.equal(a["X-Veritas-Signature"], expected);
});
test("连续修改只上传最新快照，忙碌期间的更新继续同步", async () => {
  let release;
  const sent = [];
  const sync = new CloudSync({
    secrets: vault(),
    fetcher: async (u, o) => {
      assert.equal(o.redirect, "error");
      sent.push(o.body);
      return new Promise((resolve) => (release = () => resolve(ack(o.body))));
    },
  });
  sync.enqueue({ generated_at: "first" });
  sync.enqueue({ generated_at: "second" });
  const first = sync.flush();
  assert.equal(JSON.parse(sent[0]).generated_at, "second");
  sync.enqueue({ generated_at: "third" });
  release();
  await first;
  assert.equal(sync.pending, true);
  const next = sync.flush();
  release();
  await next;
  assert.equal(JSON.parse(sent[1]).generated_at, "third");
  assert.equal(sync.status().phase, "synced");
  assert.equal(sync.pending, false);
  assert.doesNotMatch(JSON.stringify(sync.status()), new RegExp(secret));
  sync.stop();
});
test("断网和假成功保留队列与上次成功时间；不自动高频重试", async () => {
  const sync = new CloudSync({
    secrets: vault(),
    fetcher: async (u, o) => ack(o.body),
  });
  sync.enqueue({ generated_at: "a" });
  await sync.flush();
  const successful = sync.status().lastSuccess;
  sync.fetcher = async () => {
    throw new TypeError("secret raw error");
  };
  sync.enqueue({ generated_at: "b" });
  await sync.flush();
  assert.equal(sync.pending, true);
  assert.equal(sync.status().phase, "error");
  assert.equal(sync.status().lastSuccess, successful);
  assert.doesNotMatch(sync.status().message, /raw/);
  assert.ok(sync.timer._idleTimeout >= 30000);
  sync.fetcher = async () =>
    Response.json({ status: "stored", sha256: "fake" });
  await sync.flush();
  assert.equal(sync.pending, true);
  sync.fetcher = async (u, o) => ack(o.body);
  await sync.flush();
  assert.equal(sync.pending, false);
  sync.disconnect();
  assert.equal(sync.status().configured, false);
  sync.stop();
});
