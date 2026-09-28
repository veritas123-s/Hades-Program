import { createHash, createHmac, randomBytes } from "node:crypto";

export function syncURL(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error("云同步地址无效");
  }
  if (
    u.protocol !== "https:" ||
    !/^[a-z0-9-]+\.ap-shanghai\.tencentscf\.com$/.test(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/veritas-sync"
  )
    throw new Error("请填写上海区域云函数的 /veritas-sync HTTPS 地址");
  return u.href;
}
export function signedHeaders(
  secret,
  method,
  pathname,
  body,
  now = Date.now(),
) {
  const stamp = String(Math.floor(now / 1000)),
    nonce = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update([stamp, nonce, method, pathname, hash].join("\n"))
    .digest("hex");
  return {
    "Content-Type": "application/json",
    "X-Veritas-Time": stamp,
    "X-Veritas-Nonce": nonce,
    "X-Veritas-Signature": signature,
  };
}
export class CloudSync {
  constructor({ secrets, fetcher = fetch, changed = () => {} }) {
    this.secrets = secrets;
    this.fetcher = fetcher;
    this.changed = changed;
    this.config = secrets.load();
    this.latest = null;
    this.pending = false;
    this.busy = false;
    this.failures = 0;
    this.info = {
      phase: this.config.url ? "waiting" : "not_configured",
      lastSuccess: null,
      message: this.config.url
        ? "等待同步最新任务。"
        : "尚未连接云端，当前仅保存本机快报数据。",
    };
  }
  status() {
    return {
      ...this.info,
      configured: !!this.config.url,
      endpoint: this.config.url || "",
      busy: this.busy,
      pending: this.pending,
      warning: this.secrets.warning || "",
    };
  }
  update(patch) {
    this.info = { ...this.info, ...patch };
    this.changed();
  }
  configure({ url, secret }) {
    if (this.busy) throw new Error("正在同步，请稍后修改连接");
    if (this.config.url && syncURL(url) !== this.config.url && !secret)
      throw new Error("更换云同步地址时，请填写新通道自己的密钥");
    const next = { url: syncURL(url), secret: secret || this.config.secret };
    if (!/^[a-f0-9]{64}$/.test(next.secret || ""))
      throw new Error("同步密钥需为 64 位十六进制字符");
    this.secrets.save(next);
    this.config = next;
    this.failures = 0;
    this.info.lastSuccess = null;
    this.update({ phase: "waiting", message: "连接已保存，等待云端确认。" });
  }
  disconnect() {
    if (this.busy) throw new Error("正在同步，请稍后断开");
    clearTimeout(this.timer);
    this.secrets.clear();
    this.config = {};
    this.pending = false;
    this.update({
      phase: "not_configured",
      lastSuccess: null,
      message: "已停止自动上传；云端仍保留最近一次快照。",
    });
  }
  enqueue(feed, delay = 1800) {
    this.latest = JSON.stringify(feed);
    if (!this.config.url) return;
    this.pending = true;
    clearTimeout(this.timer);
    this.update({
      phase: this.busy ? "syncing" : "waiting",
      message: "任务有更新，等待上传到早晚报。",
    });
    if (!this.busy) this.timer = setTimeout(() => this.flush(), delay).unref();
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.busy || !this.pending || !this.config.url) return this.status();
    this.busy = true;
    this.pending = false;
    const body = this.latest;
    this.update({ phase: "syncing", message: "正在同步到微信早晚报…" });
    try {
      if (Buffer.byteLength(body) > 512 * 1024)
        throw new Error("快报数据超过同步容量，请精简过大的任务清单");
      const response = await this.fetcher(this.config.url, {
        method: "POST",
        redirect: "error",
        headers: signedHeaders(
          this.config.secret,
          "POST",
          "/veritas-sync",
          body,
        ),
        body,
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "云同步验证失败，请检查连接密钥和电脑时间"
            : response.status === 409
              ? "云端已有更新的数据，请校准电脑时间后重试"
              : response.status === 429
                ? "云端繁忙，将自动重试"
                : "云端暂时不可用，将自动重试",
        );
      const reader = response.body.getReader();
      let count = 0,
        chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        count += value.length;
        if (count > 16384) {
          await reader.cancel();
          throw new Error("云端确认格式异常");
        }
        chunks.push(value);
      }
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const hash = createHash("sha256").update(body).digest("hex");
      if (result.status !== "stored" || result.sha256 !== hash)
        throw new Error("云端未确认本次数据，将自动重试");
      this.failures = 0;
      this.update({
        phase: "synced",
        lastSuccess: Date.now(),
        generatedAt: result.generated_at,
        message:
          "云端已确认。08:00 晨报、21:00 晚报将按最近同步的任务与课表生成。",
      });
    } catch (error) {
      this.pending = true;
      this.failures++;
      this.update({
        phase: "error",
        message:
          error instanceof TypeError || error.name === "TimeoutError"
            ? "网络暂不可用，已保留最新任务，联网后自动重试。"
            : error instanceof SyntaxError
              ? "云端确认格式异常，将自动重试。"
              : error.message,
      });
    } finally {
      this.busy = false;
      if (this.pending)
        this.timer = setTimeout(
          () => this.flush(),
          this.failures
            ? Math.min(600000, 30000 * 2 ** Math.min(this.failures - 1, 5))
            : 100,
        ).unref();
      this.changed();
    }
    return this.status();
  }
  stop() {
    clearTimeout(this.timer);
  }
}
