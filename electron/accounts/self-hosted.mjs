export function publicUser(data) {
  const user = data?.user;
  if (typeof user?.id !== "string" || !user.id || user.id.length > 200)
    throw Error("登录已过期，请重新登录");
  return {
    id: user.id,
    email: String(user.email || "").slice(0, 254),
    nickname: String(user.name || "").slice(0, 60),
  };
}

// Only a public HTTPS origin is packaged. SecretStore encrypts session tokens.
export class SelfHostedProvider {
  constructor(config, secrets, { fetcher = fetch } = {}) {
    this.config = config;
    this.secrets = secrets;
    this.fetcher = fetcher;
    this.pending = null;
    this.token = null;
    this.origin = "";
    if (config.baseURL) {
      const u = new URL(config.baseURL);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash ||
        u.pathname !== "/"
      )
        throw Error("账号服务必须使用 HTTPS 根地址");
      this.origin = u.origin;
    }
    this.available = !!this.origin;
  }
  async initialize() {
    if (!this.available) return null;
    const saved = this.secrets.load().tokens;
    if (saved?.origin === this.origin && typeof saved.token === "string")
      this.token = saved.token;
    if (!this.token) return null;
    try {
      return await this.current();
    } catch {
      return null;
    }
  }
  async call(
    route,
    body,
    { authenticated = false, requireToken = false } = {},
  ) {
    if (!this.available)
      throw Error("账号服务尚未配置，当前数据继续保存在本机。");
    if (authenticated && !this.token) throw Error("请先登录账号");
    let response;
    try {
      response = await this.fetcher(this.origin + route, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authenticated ? { Authorization: "Bearer " + this.token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        credentials: "omit",
      });
    } catch {
      throw Error("暂时无法连接账号服务，请检查网络。");
    }
    let raw = "",
      size = 0;
    const reader = response.body?.getReader(),
      decoder = new TextDecoder();
    if (!reader) throw Error("账号服务返回了空结果");
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw Error("账号服务返回内容过大");
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw Error("账号服务返回格式无效");
    }
    if (!response.ok || data?.error) {
      const error = Error(
        response.status === 429
          ? "请求太频繁，请稍后再试。"
          : response.status === 401
            ? "邮箱或密码不正确，或登录已过期。"
            : data?.code === "EMAIL_NOT_VERIFIED"
              ? "请先完成邮箱验证。"
              : "账号操作未成功，请检查输入后重试。",
      );
      error.code = data?.code || data?.error;
      throw error;
    }
    const token = response.headers.get("set-auth-token");
    if (requireToken && !token) throw Error("账号服务未返回登录会话");
    if (token) {
      if (token.length > 4096) throw Error("账号服务返回无效会话");
      this.secrets.save({ tokens: { origin: this.origin, token } });
      this.token = token;
    }
    return data;
  }
  async login(email, password) {
    return publicUser(
      await this.call(
        "/api/auth/sign-in/email",
        { email, password },
        { requireToken: true },
      ),
    );
  }
  async send(email, kind, password) {
    this.pending = null;
    if (kind === "reset")
      await this.call("/api/auth/email-otp/request-password-reset", { email });
    else
      await this.call("/api/auth/sign-up/email", {
        email,
        password,
        name: "Hades 用户",
      });
    this.pending = { email, kind, expires: Date.now() + 600000 };
  }
  async verify(code, password) {
    const pending = this.pending;
    if (!pending || Date.now() > pending.expires)
      throw Error("验证码流程已过期，请重新发送");
    let user;
    if (pending.kind === "reset") {
      await this.call("/api/auth/email-otp/reset-password", {
        email: pending.email,
        otp: code,
        password,
      });
      user = await this.login(pending.email, password);
    } else
      user = publicUser(
        await this.call(
          "/api/auth/email-otp/verify-email",
          { email: pending.email, otp: code },
          { requireToken: true },
        ),
      );
    if (!this.token) throw Error("账号服务未返回登录会话");
    this.pending = null;
    return user;
  }
  async current() {
    return publicUser(
      await this.call("/api/auth/get-session", undefined, {
        authenticated: true,
      }),
    );
  }
  async nickname(name) {
    await this.call("/api/auth/update-user", { name }, { authenticated: true });
    return this.current();
  }
  async logout() {
    try {
      if (this.token)
        await this.call("/api/auth/sign-out", {}, { authenticated: true });
    } finally {
      this.pending = null;
      this.token = null;
      this.secrets.save({ tokens: null });
    }
  }
  async request(data) {
    return this.call("/api/sync", data, { authenticated: true });
  }
}
