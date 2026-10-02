const ROUTES = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
  "/api/auth/get-session",
  "/api/auth/sign-out",
  "/api/auth/email-otp/verify-email",
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/email-otp/request-password-reset",
  "/api/auth/email-otp/reset-password",
  "/api/sync",
]);
class Api {
  constructor(platform, origin) {
    this.wx = platform;
    this.origin = origin.replace(/\/$/, "");
    if (
      this.origin &&
      !/^https:\/\/(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        this.origin,
      )
    )
      throw Error("请配置有效的 HTTPS 域名，不支持 IP、路径或端口");
    this.token = null;
    this.generation = 0;
  }
  clear() {
    this.token = null;
    this.generation++;
  }
  async call(route, body, auth = false) {
    if (!this.origin) throw Error("账号服务域名尚未配置，可先体验演示");
    if (!ROUTES.has(route)) throw Error("不支持的接口");
    if (auth && !this.token) throw Error("请先登录");
    const generation = this.generation;
    const response = await new Promise((resolve, reject) =>
      this.wx.request({
        url: this.origin + route,
        method: body === undefined ? "GET" : "POST",
        data: body,
        timeout: 20000,
        header: {
          "content-type": "application/json",
          Origin: this.origin,
          ...(auth ? { Authorization: "Bearer " + this.token } : {}),
        },
        success: resolve,
        fail: () => reject(Error("连接失败，请检查网络后重试")),
      }),
    );
    if (generation !== this.generation) throw Error("会话已切换，请重新操作");
    const data = response.data;
    if (
      auth &&
      route === "/api/auth/get-session" &&
      response.statusCode === 200 &&
      (!data || !data.user || !data.user.id)
    ) {
      this.clear();
      if (this.onExpired) this.onExpired();
      throw Error("登录已过期，请重新登录");
    }
    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      !data ||
      typeof data !== "object" ||
      data.error
    ) {
      if (auth && response.statusCode === 401) {
        this.clear();
        if (this.onExpired) this.onExpired();
      }
      const message =
        response.statusCode === 429
          ? "操作频繁，请稍后重试"
          : response.statusCode === 401
            ? "邮箱或密码不正确，或登录已过期"
            : data && data.code === "EMAIL_NOT_VERIFIED"
              ? "请先验证邮箱"
              : response.statusCode >= 500
                ? "服务暂不可用，请稍后重试"
                : "操作未完成，请检查输入或稍后重试";
      throw Error(message);
    }
    const headers = response.header || {};
    const tokenKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === "set-auth-token",
    );
    if (tokenKey) {
      if (
        typeof headers[tokenKey] !== "string" ||
        headers[tokenKey].length > 4096
      )
        throw Error("登录会话无效");
      this.token = headers[tokenKey];
    }
    return data;
  }
  async login(email, password) {
    this.clear();
    const result = await this.call("/api/auth/sign-in/email", {
      email,
      password,
    });
    if (!this.token || !result.user || typeof result.user.id !== "string") {
      this.clear();
      throw Error("登录未返回有效会话");
    }
    return result.user;
  }
  request(body) {
    return this.call("/api/sync", body, true);
  }
}
module.exports = { Api };
