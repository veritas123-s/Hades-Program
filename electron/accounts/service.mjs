import { cloudSummary, cloudDocument } from "../../src/cloud-data.mjs";
export class Accounts {
  constructor({ profiles, provider, sync, store, restart, changed }) {
    Object.assign(this, { profiles, provider, sync, store, restart, changed });
    this.pendingUser = null;
    this.ready = false;
    this.authenticated = false;
    this.busy = false;
  }
  async initialize() {
    this.ready = !!this.provider.available;
    const user = await this.provider.initialize();
    this.authenticated = !!user && user.id === this.profiles.active?.id;
    this.sync?.start();
  }
  status() {
    return {
      ready: this.ready,
      user: this.profiles.active,
      authenticated: this.authenticated,
      pendingUser: this.pendingUser,
      localSummary: cloudSummary(cloudDocument(this.store.state)),
      sync: this.sync?.status() || null,
    };
  }
  async execute(action, p = {}) {
    if (action === "account.state") return this.status();
    if (this.busy) throw Error("账号操作进行中，请稍候");
    this.busy = true;
    try {
      if (["account.login", "account.send"].includes(action)) {
        if (this.sync?.busy) throw Error("正在同步，请完成后再登录");
        this.sync?.stop();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || p.email.length > 254)
          throw Error("请输入有效邮箱");
        if (action === "account.login" || p.kind === "register")
          this.password(p.password);
      }
      if (action === "account.login")
        this.pendingUser = await this.provider.login(p.email, p.password);
      else if (action === "account.send") {
        if (!["register", "reset"].includes(p.kind))
          throw Error("验证方式无效");
        await this.provider.send(p.email, p.kind, p.password);
        return { sent: true };
      } else if (action === "account.verify") {
        if (!/^\d{4,8}$/.test(p.code)) throw Error("请输入有效验证码");
        if (this.provider.pending?.kind === "reset") this.password(p.password);
        this.pendingUser = await this.provider.verify(p.code, p.password);
      } else if (action === "account.activate") {
        if (!this.pendingUser) throw Error("请先登录");
        if (this.store.state.timer.status !== "idle")
          throw Error("请先保存当前专注，再切换账号");
        if (this.pendingUser.id === this.profiles.active?.id) {
          this.authenticated = true;
          this.pendingUser = null;
          return this.status();
        }
        if (p.mode !== "empty" && p.mode !== "copy")
          throw Error("请选择如何开始使用这个账号");
        if (this.profiles.active && p.mode === "copy")
          throw Error("不能把其他账号的数据复制到此账号");
        this.store.backup();
        this.sync?.stop();
        const seed =
          p.mode === "copy" ? structuredClone(this.store.state) : null;
        this.profiles.prepare(this.pendingUser, seed);
        this.profiles.select(this.pendingUser);
        this.restart();
        return { restarting: true };
      } else if (action === "account.logout") {
        if (this.store.state.timer.status !== "idle")
          throw Error("请先保存当前专注，再退出账号");
        if (this.sync?.busy) throw Error("正在同步，请完成后再退出");
        this.store.backup();
        this.sync?.stop();
        try {
          await this.provider.logout();
        } finally {
          this.profiles.select(null);
          this.restart();
        }
        return { restarting: true };
      } else if (action === "account.nickname") {
        if (!this.authenticated) throw Error("请先登录");
        const nickname = String(p.nickname || "").trim();
        if (!nickname || nickname.length > 60) throw Error("昵称需为1至60字");
        this.profiles.select(await this.provider.nickname(nickname));
      } else if (action === "account.sync") {
        if (!this.sync) throw Error("请先登录账号");
        if (p.resolution && !["local", "remote"].includes(p.resolution))
          throw Error("同步选项无效");
        await this.sync.run(p.resolution);
      } else if (action === "account.sync.configure") {
        if (!this.sync || !this.authenticated) throw Error("请先登录账号");
        if (typeof p.enabled !== "boolean") throw Error("同步设置无效");
        await this.sync.configure(p.enabled);
      } else throw Error("不支持的账号操作");
      if (this.pendingUser?.id === this.profiles.active?.id) {
        this.authenticated = true;
        this.pendingUser = null;
        this.sync?.start();
      }
      return this.status();
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  password(value) {
    if (typeof value !== "string" || value.length < 8 || value.length > 128)
      throw Error("密码需为8至128位");
  }
}
