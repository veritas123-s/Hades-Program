// Browser protocol adapted from TencentCloud/tencentcloud-cli (Apache-2.0).
// Modified for VERITAS: loopback only, state checked before exchange, TLS verified,
// bounded responses, cancellation and temporary credentials kept only in memory.
import http from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { boundedText, TencentAPI, CloudError } from "./tencent-api.mjs";

export class TencentLogin {
  constructor({ openExternal, fetcher = fetch, changed = () => {} }) {
    this.openExternal = openExternal;
    this.fetcher = fetcher;
    this.changed = changed;
    this.info = { phase: "signed_out", message: "尚未登录腾讯云。" };
  }
  status() {
    const valid =
      !!this.credentials &&
      this.credentials.expiresAt * 1000 > Date.now() + 30_000;
    return {
      ...this.info,
      authenticated: valid,
      account: valid ? `APPID ${this.identity.AppId}` : "",
      expiresAt: valid ? this.credentials.expiresAt * 1000 : null,
    };
  }
  update(info) {
    this.info = { ...this.info, ...info };
    this.changed();
  }
  async start() {
    this.stop();
    const attempt = (this.attempt = randomBytes(32).toString("hex"));
    this.update({ phase: "starting", message: "正在打开腾讯云官方授权页面…" });
    const server = (this.server = http.createServer(
      (req, res) => void this.callback(attempt, req, res),
    ));
    server.maxHeadersCount = 20;
    server.requestTimeout = 15_000;
    server.headersTimeout = 15_000;
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const redirect = new URL("https://cli.cloud.tencent.com/oauth");
      redirect.search = new URLSearchParams({
        redirect_url: `http://localhost:${server.address().port}`,
        lang: "zh-CN",
        site: "cn",
      });
      const url = new URL("https://cloud.tencent.com/open/authorize");
      url.search = new URLSearchParams({
        scope: "login",
        app_id: "100038427476",
        redirect_url: redirect.href,
        state: attempt,
      });
      this.timer = setTimeout(() => {
        this.stop();
        this.update({
          phase: "expired",
          message: "登录等待已超时，请重新扫码。",
        });
      }, 10 * 60_000).unref();
      this.update({
        phase: "waiting",
        message: "请在浏览器选择微信扫码，登录你自己的腾讯云并完成授权。",
      });
      await this.openExternal(url.href);
      return this.status();
    } catch {
      this.stop();
      this.update({
        phase: "error",
        message: "无法打开腾讯云登录，请检查默认浏览器和本机端口。",
      });
      return this.status();
    }
  }
  async callback(attempt, req, res) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    const reject = () => {
      res.writeHead(400);
      res.end("授权请求无效，请回到 Hades 重新登录。");
    };
    if (
      req.method !== "GET" ||
      req.url.length > 32768 ||
      !/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || "")
    )
      return reject();
    const url = new URL(req.url, "http://localhost");
    const state = url.searchParams.get("state") || "";
    if (
      url.pathname !== "/" ||
      this.attempt !== attempt ||
      !/^[a-f0-9]{64}$/.test(state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(attempt)) ||
      url.searchParams.get("site") !== "cn" ||
      this.exchanging
    )
      return reject();
    const access = url.searchParams.get("access_token");
    if (!access || access.length > 16384) return reject();
    this.exchanging = true;
    this.update({
      phase: "authorizing",
      message: "正在核验腾讯云身份与临时授权…",
    });
    try {
      const response = await this.fetcher(
        "https://cli.cloud.tencent.com/get_temp_cred",
        {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            TraceId: randomUUID(),
            AccessToken: access,
            Site: "cn",
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      const data = JSON.parse(await boundedText(response, 65536));
      if (
        !response.ok ||
        data.Error ||
        !data.SecretId ||
        !data.SecretKey ||
        !data.Token ||
        !Number.isFinite(data.ExpiresAt) ||
        data.ExpiresAt * 1000 <= Date.now() + 60_000
      )
        throw new Error();
      const credentials = {
        secretId: data.SecretId,
        secretKey: data.SecretKey,
        token: data.Token,
        expiresAt: data.ExpiresAt,
      };
      const identity = await new TencentAPI(credentials, this.fetcher).call(
        "cam",
        "GetUserAppId",
      );
      if (
        !/^\d+$/.test(String(identity.AppId)) ||
        !/^\d+$/.test(identity.OwnerUin)
      )
        throw new Error();
      if (this.attempt !== attempt) {
        res.end("本次登录已取消。");
        return;
      }
      this.credentials = credentials;
      this.identity = identity;
      this.update({
        phase: "authenticated",
        message: "腾讯云身份已验证。请返回应用绑定微信，并确认独立开通服务。",
      });
      res.end(
        "腾讯云登录成功。请关闭此页面，返回 Hades 继续。此时尚未创建云资源。",
      );
    } catch {
      if (this.attempt === attempt)
        this.update({
          phase: "error",
          message:
            "腾讯云授权核验失败，请重新登录或在控制台完成实名及身份验证。",
        });
      res.statusCode = 400;
      res.end("授权核验失败。请返回 Hades 重试。");
    } finally {
      if (this.attempt === attempt) {
        clearTimeout(this.timer);
        this.server?.close();
        this.server = null;
        this.attempt = null;
        this.exchanging = false;
      }
    }
  }
  api() {
    if (!this.status().authenticated)
      throw new CloudError("请先扫码登录你自己的腾讯云账号。");
    return new TencentAPI(this.credentials, this.fetcher);
  }
  stop() {
    clearTimeout(this.timer);
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = null;
    this.attempt = null;
    this.exchanging = false;
    this.credentials = null;
    this.identity = null;
  }
  logout() {
    this.stop();
    this.update({
      phase: "signed_out",
      message: "已清除本次腾讯云临时授权；已开通的提醒服务继续运行。",
    });
    return this.status();
  }
}
