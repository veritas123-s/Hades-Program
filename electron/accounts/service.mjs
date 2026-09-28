import { cloudSummary, cloudDocument } from "../../src/cloud-data.mjs";
import { requireAccount } from "./access.mjs";
export class Accounts {
  constructor({ profiles, provider, sync, store, restart, changed }) {
    Object.assign(this, { profiles, provider, sync, store, restart, changed });
    this.pendingUser = null;
    this.ready = false;
    this.authenticated = false;
    this.busy = false;
  }
  async initialize() {
    this.busy = true;
    this.ready = false;
    try {
      const user = await this.provider.initialize();
      this.authenticated = !!user && user.id === this.profiles.active?.id;
      if (this.authenticated) this.sync?.start();
      else this.sync?.stop();
    } finally {
      this.ready = !!this.provider.available;
      this.busy = false;
    }
  }
  status() {
    return {
      ready: this.ready,
      user: this.authenticated ? this.profiles.active : null,
      authenticated: this.authenticated,
      pendingUser: this.pendingUser,
      verificationPending: !!this.provider.pending,
      canImportLegacy:
        !!this.pendingUser &&
        !this.profiles.active &&
        this.profiles.canImportLegacy(this.pendingUser),
      localSummary: this.authenticated
        ? cloudSummary(cloudDocument(this.store.state))
        : null,
      sync: this.authenticated ? this.sync?.status() || null : null,
    };
  }
  async execute(action, p = {}) {
    requireAccount(this, action);
    if (action === "account.cancel") {
      this.provider.cancel();
      return { canceled: true };
    }
    if (action === "account.state") return this.status();
    if (this.busy) throw Error("账号操作进行中，请稍候");
    if (
      this.authenticated &&
      [
        "account.login",
        "account.send",
        "account.resend",
        "account.verify",
      ].includes(action)
    )
      throw Error("请先退出当前账号，再登录其他账号");
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
      } else if (action === "account.resend") {
        await this.provider.resend(p.email, p.kind);
        return { sent: true };
      } else if (action === "account.verify") {
        if (!/^\d{4,8}$/.test(p.code)) throw Error("请输入有效验证码");
        if (p.email !== undefined) {
          if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ||
            p.email.length > 254 ||
            !["register", "reset"].includes(p.kind)
          )
            throw Error("请输入有效邮箱和验证方式");
          this.provider.pending = {
            email: p.email,
            kind: p.kind,
            expires: Date.now() + 600000,
          };
        }
        if (this.provider.pending?.kind === "reset") this.password(p.password);
        this.pendingUser = await this.provider.verify(p.code, p.password);
      } else if (action === "account.activate") {
        if (!this.pendingUser) throw Error("请先登录");
        if (this.store.state.timer.status === "running")
          throw Error("请先保存当前专注，再切换账号");
        if (this.pendingUser.id === this.profiles.active?.id) {
          this.authenticated = true;
          this.pendingUser = null;
          this.sync?.start();
          return this.status();
        }
        if (p.mode !== "empty" && p.mode !== "copy")
          throw Error("请选择如何开始使用这个账号");
        if (this.profiles.active && p.mode === "copy")
          throw Error("不能把其他账号的数据复制到此账号");
        if (
          p.mode === "copy" &&
          !this.profiles.canImportLegacy(this.pendingUser)
        )
          throw Error("本机旧数据已归属其他账号，不能再次复制");
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
        this.authenticated = false;
        this.pendingUser = null;
        this.provider.onInvalidSession?.();
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
        if (!this.sync || !this.authenticated) throw Error("请先登录账号");
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
