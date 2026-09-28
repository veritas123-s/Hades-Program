import { ENTRY, isSchoolURL, schoolJSON } from "./campus.mjs";

export function cookieForRestore(cookie, now = Date.now() / 1000) {
  if (
    !cookie ||
    typeof cookie.domain !== "string" ||
    typeof cookie.name !== "string" ||
    typeof cookie.value !== "string"
  )
    return null;
  const host = cookie.domain.replace(/^\./, "");
  if (
    !isSchoolURL(`https://${host}/`) ||
    (cookie.expirationDate && cookie.expirationDate <= now)
  )
    return null;
  const result = {
    url: `https://${host}${cookie.path || "/"}`,
    name: cookie.name,
    value: cookie.value,
    path: cookie.path || "/",
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: cookie.sameSite || "unspecified",
  };
  if (!cookie.hostOnly) result.domain = cookie.domain;
  if (cookie.expirationDate) result.expirationDate = cookie.expirationDate;
  return result;
}
export class CampusAuth {
  constructor({ session, BrowserWindow, vault, changed }) {
    Object.assign(this, { session, BrowserWindow, vault, changed });
    this.window = null;
    this.pending = null;
    this.lastAttempt = 0;
    this.phase = "idle";
    this.message = vault.warning || "登录后会加密记住会话，下次自动恢复。";
    this.saving = null;
    this.generation = 0;
    this.restoring = false;
  }
  status() {
    return { ...this.vault.status(), phase: this.phase, message: this.message };
  }
  set(phase, message) {
    this.phase = phase;
    this.message = message;
    this.changed?.();
  }
  async initialize() {
    this.restoring = true;
    let restored = 0;
    for (const cookie of this.vault.data.cookies) {
      const details = cookieForRestore(cookie);
      if (details)
        try {
          await this.session.cookies.set(details);
          restored++;
        } catch {
          this.message = "部分会话已失效，同步时会尝试重新认证。";
        }
    }
    this.restoring = false;
    if (restored) this.set("restored", "已恢复加密会话，同步时验证学校连接。");
    this.session.cookies.on("changed", () => {
      if (!this.restoring && this.vault.data.remember) {
        clearTimeout(this.saving);
        this.saving = setTimeout(
          () =>
            this.persist().catch(() =>
              this.set("attention", "会话加密保存失败，当前窗口仍可使用。"),
            ),
          400,
        );
      }
    });
  }
  async persist() {
    if (!this.vault.data.remember) return;
    const generation = this.generation;
    const cookies = (await this.session.cookies.get({})).filter((c) =>
      cookieForRestore(c),
    );
    if (generation !== this.generation || !this.vault.data.remember) return;
    this.vault.save({ cookies });
  }
  configure({ username, password, remember = true }) {
    const patch = { remember: !!remember };
    if (username || password) {
      if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        !username.trim() ||
        !password ||
        username.length > 200 ||
        password.length > 1000
      )
        throw new Error("请填写有效账号和密码");
      patch.credentials = { username: username.trim(), password };
    }
    if (!remember) {
      patch.credentials = null;
      patch.cookies = [];
    }
    this.vault.save(patch);
    this.lastAttempt = 0;
    this.set(
      "idle",
      patch.credentials
        ? "已加密保存，下次会话过期时尝试自动登录。"
        : "登录设置已保存。",
    );
  }
  async open(visible = true) {
    if (this.window && !this.window.isDestroyed()) {
      if (visible) {
        this.window.show();
        this.window.focus();
      }
      return this.window;
    }
    const window = (this.window = new this.BrowserWindow({
      width: 1180,
      height: 820,
      show: visible,
      title: "VERITAS · 校园认证",
      autoHideMenuBar: true,
      webPreferences: {
        session: this.session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    }));
    const guard = (e, url) => {
      if (!isSchoolURL(url)) e.preventDefault();
    };
    window.webContents.on("will-navigate", guard);
    window.webContents.on("will-redirect", guard);
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isSchoolURL(url))
        window
          .loadURL(url)
          .catch(() => this.set("attention", "学校页面未能打开"));
      return { action: "deny" };
    });
    window.webContents.on("did-finish-load", () =>
      this.persist().catch(() => this.set("attention", "学校会话未能保存")),
    );
    await window.loadURL(ENTRY).catch(() => {
      throw new Error("学校认证页面加载失败，请检查网络。");
    });
    return window;
  }
  async renew() {
    if (this.pending) return this.pending;
    if (Date.now() - this.lastAttempt < 60000)
      throw new Error(
        "自动登录未完成，请在学校窗口验证后重试；不会连续尝试密码。",
      );
    this.lastAttempt = Date.now();
    this.pending = (async () => {
      this.set("renewing", "正在通过学校认证恢复会话…");
      const existing = this.window && !this.window.isDestroyed();
      const window = await this.open(false);
      if (existing)
        await window.loadURL(ENTRY).catch(() => {
          throw new Error("学校认证页面加载失败，请检查网络。");
        });
      if (!isSchoolURL(window.webContents.getURL()))
        throw new Error("学校认证地址不在允许范围内");
      // Read the page state only. The school retains responsibility for RSA and challenge handling.
      const probe = await window.webContents.executeJavaScript(
        `(()=>({form:!!document.querySelector('input[name="username"]'),challenge:[...document.querySelectorAll('input[name="authcode"],input[name*="captcha"],input[name*="otp"]')].some(e=>e.offsetParent!==null)||/滑块验证|短信验证/.test(document.body.innerText)}))()`,
      );
      if (probe.form) {
        const credentials = this.vault.data.credentials;
        if (!credentials) {
          window.show();
          this.set(
            "attention",
            "会话已过期，请登录一次；也可设置加密自动登录。",
          );
          throw new Error(this.message);
        }
        // Credentials are inserted only in the already-verified school document.
        const value = JSON.stringify(credentials).replace(/</g, "\\u003c");
        const credentialsScript = `(()=>{const credentials=${value};const user=document.querySelector('input[name="username"]'),pass=document.querySelector('input[name="password"]');if(!user||!pass)return false;for(const [field,value] of [[user,credentials.username],[pass,credentials.password]]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()`;
        const filled = await window.webContents
          .executeJavaScript(credentialsScript)
          .catch(() => {
            throw new Error("无法自动填入学校表单，请手动登录。");
          });
        if (!filled) {
          window.show();
          throw new Error("学校登录表单已变化，请在学校窗口登录。");
        }
        if (probe.challenge) {
          window.show();
          this.set("attention", "账号已自动填入，请完成学校验证码后同步。");
          throw new Error(this.message);
        }
        const loaded = new Promise((resolve) => {
          const timer = setTimeout(resolve, 8000);
          window.webContents.once("did-finish-load", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        await window.webContents.executeJavaScript(
          `(()=>{const form=document.querySelector('input[name="password"]')?.form;const button=form?.querySelector('button[type="submit"],input[type="submit"],button');if(button)button.click();else form?.requestSubmit();})()`,
        );
        await loaded;
      }
      await this.persist();
    })().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async request(base, route, params) {
    try {
      const data = await schoolJSON(this.session, base, route, params);
      this.set("connected", "学校连接有效，会话已记住。");
      await this.persist();
      return data;
    } catch (error) {
      if (error.code !== "AUTH_REQUIRED") throw error;
      await this.renew();
      try {
        const data = await schoolJSON(this.session, base, route, params);
        this.set("connected", "已自动恢复学校登录。");
        await this.persist();
        return data;
      } catch {
        if (this.window && !this.window.isDestroyed()) this.window.show();
        this.set("attention", "学校仍需要验证，请在学校窗口完成后重试。");
        throw new Error(this.message);
      }
    }
  }
  async logout() {
    this.generation++;
    clearTimeout(this.saving);
    if (this.window && !this.window.isDestroyed()) this.window.close();
    this.vault.clear();
    await this.session.clearStorageData();
    await this.session.clearCache();
    this.lastAttempt = 0;
    this.set("idle", "已清除账号和会话；课表缓存仍保留。");
  }
}
