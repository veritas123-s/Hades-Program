const d = require("./domain");
const clone = (value) => JSON.parse(JSON.stringify(value));
const recordKey = (user) => "medstack:mp:v1:" + encodeURIComponent(user.id);
class Store {
  constructor(platform) {
    this.wx = platform;
    this.user = null;
    this.busy = false;
    this.epoch = 0;
    this.status = "";
  }
  open(user, demo = false) {
    this.close();
    if (
      !user ||
      typeof user.id !== "string" ||
      !user.id ||
      user.id.length > 200
    )
      throw Error("账号无效");
    this.user = { id: user.id, name: user.name || "", email: user.email || "" };
    this.demo = demo;
    try {
      const saved = this.wx.getStorageSync(recordKey(user));
      if (saved) {
        if (!Number.isSafeInteger(saved.version) || saved.version < 0)
          throw Error("缓存版本无效");
        this.state = d.validateState(saved.state);
        this.version = saved.version;
        this.dirty = !!saved.dirty;
        this.revision = saved.revision || 0;
      } else {
        this.state = d.initialState();
        this.version = 0;
        this.dirty = false;
        this.revision = 0;
      }
      this.status = demo
        ? "演示数据 · 仅保存在当前设备"
        : this.dirty
          ? "本机有未同步修改"
          : "尚未同步";
    } catch (error) {
      this.close();
      throw Error("本机缓存异常，已保留原文件，请联系开发者");
    }
    return this;
  }
  close() {
    this.epoch++;
    this.user = null;
    this.state = null;
    this.conflict = null;
    this.busy = false;
    this.demo = false;
    this.status = "";
  }
  requireUser() {
    if (!this.user || !this.state) throw Error("请先登录");
  }
  persist() {
    this.requireUser();
    this.wx.setStorageSync(recordKey(this.user), {
      state: this.state,
      version: this.version,
      dirty: this.dirty,
      revision: this.revision,
    });
  }
  mutate(fn, cloud = true) {
    this.requireUser();
    const previous = clone(this.state),
      dirty = this.dirty,
      revision = this.revision;
    try {
      fn(this.state);
      if (cloud) {
        this.dirty = true;
        this.revision++;
      }
      this.persist();
      if (cloud)
        this.status = this.demo ? "演示修改已保存" : "本机有未同步修改";
    } catch (error) {
      this.state = previous;
      this.dirty = dirty;
      this.revision = revision;
      throw error;
    }
  }
  tick(now = Date.now()) {
    this.requireUser();
    if (this.state.timer.status !== "running") return;
    this.mutate((s) => {
      const result = d.tickTimer(s, now);
      if (result) {
        this.dirty = true;
        this.revision++;
      }
    }, false);
  }
  async sync(api, resolution) {
    this.requireUser();
    if (this.demo) {
      this.status = "演示模式不连接云端";
      return;
    }
    if (this.busy) return;
    const epoch = this.epoch;
    const live = () => {
      if (epoch !== this.epoch || !this.user) throw Error("会话已切换");
    };
    this.busy = true;
    this.status = "同步中…";
    try {
      const identity = await api.call("/api/auth/get-session", undefined, true);
      live();
      if (!identity.user || identity.user.id !== this.user.id)
        throw Error("账号与本机工作区不一致");
      const remote = await api.request({ action: "pull" });
      live();
      if (!Number.isSafeInteger(remote.version) || remote.version < 0)
        throw Error("云端版本无效");
      const doc =
        remote.document === null
          ? null
          : d.validateCloudDocument(remote.document);
      if (remote.version < this.version)
        throw Error("云端版本回退，已停止同步，请联系开发者");
      const changed = remote.version !== this.version;
      if (
        (resolution &&
          (!this.conflict ||
            remote.version !== this.conflict.version ||
            this.revision !== this.conflict.revision)) ||
        (doc && changed && this.dirty && !resolution)
      ) {
        this.conflict = { version: remote.version, revision: this.revision };
        this.status = "两端都有修改，请在“我的”中处理";
        return;
      }
      if (resolution && !["local", "remote"].includes(resolution))
        throw Error("同步选择无效");
      if (resolution) {
        // Abort if backup storage fails; preserve both complete documents before replacement.
        this.wx.setStorageSync(recordKey(this.user) + ":backup:" + Date.now(), {
          local: d.cloudDocument(this.state),
          remote: doc,
        });
      }
      if (doc && (resolution === "remote" || (changed && !this.dirty))) {
        const prior = {
          state: this.state,
          version: this.version,
          dirty: this.dirty,
        };
        try {
          this.state = { ...this.state, ...doc };
          this.version = remote.version;
          this.dirty = false;
          this.persist();
        } catch (error) {
          Object.assign(this, prior);
          throw error;
        }
      } else if (this.dirty || !doc || resolution === "local") {
        const revision = this.revision;
        const document = d.cloudDocument(this.state);
        const pushed = await api.request({
          action: "push",
          version: remote.version,
          document,
        });
        live();
        if (pushed.conflict) {
          this.conflict = null;
          this.status = "云端刚有新修改，请重新同步";
          return;
        }
        if (pushed.version !== remote.version + 1)
          throw Error("云端未确认保存，请重试");
        this.version = pushed.version;
        this.dirty = revision !== this.revision;
        this.persist();
      }
      this.conflict = null;
      this.status = this.dirty ? "仍有新修改待同步" : "已同步";
    } catch (error) {
      if (epoch === this.epoch)
        this.status = error.message + "；本机修改已保留";
      throw error;
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
}
module.exports = { Store, recordKey };
