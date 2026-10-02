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
  constructor(
    config,
    secrets,
    { fetcher = fetch, timeoutMs = 20000, mailTimeoutMs = 45000 } = {},
  ) {
    this.config = config;
    this.secrets = secrets;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.mailTimeoutMs = mailTimeoutMs;
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
  async call(route, body, options = {}) {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error(
            "账号服务响应超时。若已收到验证码，可继续验证；未收到可重新发送。",
          ),
        ),
      options.mail ? this.mailTimeoutMs : this.timeoutMs,
    );
    try {
      return await Promise.race([
        this.performCall(route, body, {
          ...options,
          signal: controller.signal,
        }),
        new Promise((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true },
          ),
        ),
      ]);
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = null;
    }
  }
  cancel() {
    this.controller?.abort(
      new Error("已停止等待；如果邮箱已收到验证码，仍可继续验证。"),
    );
  }
  invalidate() {
    this.token = null;
    this.secrets.save({ tokens: null });
    this.onInvalidSession?.();
  }
  async performCall(
    route,
    body,
    { authenticated = false, requireToken = false, signal } = {},
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
          // Native fetch carries Chromium Fetch Metadata but no web-page Origin.
          // Identify this configured HTTPS origin without relaxing server CSRF checks.
          Origin: this.origin,
          ...(authenticated ? { Authorization: "Bearer " + this.token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
        redirect: "error",
        credentials: "omit",
      });
    } catch {
      signal?.throwIfAborted();
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
        signal?.throwIfAborted();
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
      if (authenticated && response.status === 401) this.invalidate();
      const error = Error(
        response.status === 429
          ? "请求太频繁，请稍后再试。"
          : response.status === 401
            ? "邮箱或密码不正确，或登录已过期。"
            : data?.code === "EMAIL_NOT_VERIFIED"
              ? "请先完成邮箱验证。"
              : [
                    "USER_ALREADY_EXISTS",
                    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                  ].includes(data?.code)
                ? "这个邮箱已有账号。可登录，或点击重新发送完成邮箱验证。"
                : response.status >= 500
                  ? "账号服务暂时未能完成请求。若未收到邮件，请稍后重新发送验证码。"
                  : "账号操作未成功，请检查输入后重试。",
      );
      error.code = data?.code || data?.error;
      throw error;
    }
    signal?.throwIfAborted();
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
    this.pending = { email, kind, expires: Date.now() + 600000 };
    if (kind === "reset")
      await this.call(
        "/api/auth/email-otp/request-password-reset",
        { email },
        { mail: true },
      );
    else
      await this.call(
        "/api/auth/sign-up/email",
        {
          email,
          password,
          name: "医栈通 用户",
        },
        { mail: true },
      );
  }
  async resend(email, kind) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !["register", "reset"].includes(kind)
    )
      throw Error("请输入有效邮箱和验证方式");
    this.pending = { email, kind, expires: Date.now() + 600000 };
    await this.call(
      kind === "reset"
        ? "/api/auth/email-otp/request-password-reset"
        : "/api/auth/email-otp/send-verification-otp",
      kind === "reset" ? { email } : { email, type: "email-verification" },
      { mail: true },
    );
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
    const result = await this.call("/api/auth/get-session", undefined, {
      authenticated: true,
    });
    if (!result?.user?.id) {
      this.invalidate();
      throw Error("登录已过期，请重新登录");
    }
    return publicUser(result);
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
