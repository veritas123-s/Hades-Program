import { createHash, createHmac } from "node:crypto";

const versions = { cam: "2019-01-16", scf: "2018-04-16" };
export const REGION = "ap-shanghai";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const hmac = (key, s) => createHmac("sha256", key).update(s).digest();

export class CloudError extends Error {
  constructor(message, code = "") {
    super(message);
    this.code = code;
  }
}
export async function boundedText(response, limit = 2_000_000) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new CloudError("云端响应过大，请稍后重试。");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function apiHeaders(
  service,
  action,
  body,
  credentials,
  now = Date.now(),
) {
  if (!versions[service]) throw new CloudError("云服务类型无效。");
  const stamp = Math.floor(now / 1000),
    date = new Date(now).toISOString().slice(0, 10);
  const host = `${service}.tencentcloudapi.com`,
    contentType = "application/json; charset=utf-8";
  const canonical = `POST\n/\n\ncontent-type:${contentType}\nhost:${host}\n\ncontent-type;host\n${hash(body)}`;
  const scope = `${date}/${service}/tc3_request`;
  const toSign = `TC3-HMAC-SHA256\n${stamp}\n${scope}\n${hash(canonical)}`;
  const key = hmac(
    hmac(hmac("TC3" + credentials.secretKey, date), service),
    "tc3_request",
  );
  return {
    "Content-Type": contentType,
    Host: host,
    "X-TC-Action": action,
    "X-TC-Version": versions[service],
    "X-TC-Timestamp": String(stamp),
    "X-TC-Region": REGION,
    "X-TC-Token": credentials.token,
    Authorization: `TC3-HMAC-SHA256 Credential=${credentials.secretId}/${scope}, SignedHeaders=content-type;host, Signature=${createHmac("sha256", key).update(toSign).digest("hex")}`,
  };
}
export class TencentAPI {
  constructor(credentials, fetcher = fetch) {
    this.credentials = credentials;
    this.fetcher = fetcher;
  }
  check() {
    if (
      !this.credentials ||
      this.credentials.expiresAt * 1000 < Date.now() + 30_000
    )
      throw new CloudError(
        "腾讯云授权已过期，请重新扫码登录后继续。",
        "AuthExpired",
      );
  }
  async call(service, action, payload = {}) {
    this.check();
    const body = JSON.stringify(payload);
    let response, value;
    try {
      response = await this.fetcher(`https://${service}.tencentcloudapi.com/`, {
        method: "POST",
        redirect: "error",
        body,
        headers: apiHeaders(service, action, body, this.credentials),
        signal: AbortSignal.timeout(60_000),
      });
      value = JSON.parse(await boundedText(response)).Response;
    } catch {
      throw new CloudError(
        "腾讯云连接失败，操作结果尚未确认；请检查网络后继续。",
        "NetworkError",
      );
    }
    if (!response.ok || !value || value.Error) {
      const raw = value?.Error?.Code || `HTTP${response.status}`;
      const code = /^[a-zA-Z0-9.]{1,100}$/.test(raw) ? raw : "UnknownError";
      let hint = "请稍后重试，或在腾讯云控制台检查服务状态。";
      if (/Auth|Unauthorized|Permission/i.test(code))
        hint =
          "请重新授权；若仍失败，请检查账号的 SCF、COS、CAM 权限及身份验证。";
      if (/Balance|ServiceClosed|NotActivated/i.test(code))
        hint = "请在腾讯云控制台完成实名、服务开通并检查余额，再继续。";
      throw new CloudError(`腾讯云 ${action} 未完成（${code}）。${hint}`, code);
    }
    return value;
  }
  async bucket(method, bucket, { acl = false } = {}) {
    this.check();
    if (!/^veritas-[a-f0-9]{16}-\d+$/.test(bucket))
      throw new CloudError("存储桶名称无效。");
    const host = `${bucket}.cos.${REGION}.myqcloud.com`;
    const now = Math.floor(Date.now() / 1000),
      time = `${now - 30};${now + 180}`;
    const headers = { host, "x-cos-security-token": this.credentials.token };
    if (method === "PUT") headers["x-cos-acl"] = "private";
    const enc = (v) =>
      encodeURIComponent(v).replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
      );
    const names = Object.keys(headers).sort();
    const canonical = `${method.toLowerCase()}\n/\n${acl ? "acl=" : ""}\n${names.map((k) => `${enc(k)}=${enc(headers[k])}`).join("&")}\n`;
    const sha1 = (s) => createHash("sha1").update(s).digest("hex");
    const signKey = createHmac("sha1", this.credentials.secretKey)
      .update(time)
      .digest("hex");
    const signature = createHmac("sha1", signKey)
      .update(`sha1\n${time}\n${sha1(canonical)}\n`)
      .digest("hex");
    headers.authorization = `q-sign-algorithm=sha1&q-ak=${this.credentials.secretId}&q-sign-time=${time}&q-key-time=${time}&q-header-list=${names.join(";")}&q-url-param-list=${acl ? "acl" : ""}&q-signature=${signature}`;
    let response, body;
    try {
      response = await this.fetcher(`https://${host}/${acl ? "?acl" : ""}`, {
        method,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      body = await boundedText(response, 65536);
    } catch {
      throw new CloudError(
        "私有存储连接失败，请检查网络后继续。",
        "NetworkError",
      );
    }
    if (
      !response.ok &&
      !(
        method === "PUT" &&
        response.status === 409 &&
        body.includes("BucketAlreadyOwnedByYou")
      )
    )
      throw new CloudError(
        `私有存储未完成（HTTP ${response.status}）；请检查 COS 服务开通、余额和权限。`,
        `COS${response.status}`,
      );
    return body;
  }
}
