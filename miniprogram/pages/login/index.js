const config = require("../../config");
const { notify } = require("../../lib/page");
Page({
  data: {
    mode: "login",
    email: "",
    password: "",
    otp: "",
    busy: false,
    sent: false,
    ready: !!config.apiOrigin,
    demoEnabled: config.demoEnabled,
  },
  onShow() {
    require("../../lib/appearance").applyChrome(wx, {
      state: { workspace: { theme: "medical" } },
    });
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  mode(e) {
    if (!this.data.busy)
      this.setData({
        mode: e.currentTarget.dataset.mode,
        sent: false,
        otp: "",
        password: "",
      });
  },
  async submit() {
    if (this.data.busy) return;
    const { mode, password, otp, sent } = this.data,
      email = this.data.email.trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 128
    ) {
      notify(Error("请输入有效邮箱和 8–128 位密码"));
      return;
    }
    this.setData({ busy: true });
    const app = getApp();
    try {
      if (mode === "login") {
        await app.login(email, password);
      } else if (!sent) {
        await app.api.call(
          mode === "register"
            ? "/api/auth/sign-up/email"
            : "/api/auth/email-otp/request-password-reset",
          mode === "register"
            ? { email, password, name: "医栈通 用户" }
            : { email },
        );
        this.setData({ sent: true });
        wx.showToast({ title: "请查收邮箱验证码", icon: "none" });
      } else {
        if (!/^\d{6}$/.test(otp)) throw Error("请输入 6 位验证码");
        await app.api.call(
          mode === "register"
            ? "/api/auth/email-otp/verify-email"
            : "/api/auth/email-otp/reset-password",
          mode === "register" ? { email, otp } : { email, otp, password },
        );
        await app.login(email, password);
      }
      if (app.store.user) this.setData({ password: "", otp: "" });
    } catch (error) {
      notify(error);
    } finally {
      this.setData({ busy: false });
    }
  },
  async resend() {
    if (this.data.busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.data.email.trim())) {
      notify(Error("请输入有效邮箱"));
      return;
    }
    this.setData({ busy: true });
    try {
      await getApp().api.call(
        this.data.mode === "reset"
          ? "/api/auth/email-otp/request-password-reset"
          : "/api/auth/email-otp/send-verification-otp",
        this.data.mode === "reset"
          ? { email: this.data.email.trim() }
          : { email: this.data.email.trim(), type: "email-verification" },
      );
      this.setData({ sent: true });
      wx.showToast({ title: "验证码已请求发送", icon: "none" });
    } catch (error) {
      notify(error);
    } finally {
      this.setData({ busy: false });
    }
  },
  demo() {
    if (!config.demoEnabled || this.data.busy) return;
    try {
      getApp().demo();
    } catch (error) {
      notify(error);
    }
  },
});
