import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  cloudDocument,
  validateCloudDocument,
  cloudSummary,
} from "../../src/cloud-data.mjs";
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
export class AccountSync {
  constructor({ directory, store, provider, user, changed = () => {} }) {
    Object.assign(this, { directory, store, provider, user, changed });
    this.file = path.join(directory, "account-sync.json");
    this.meta = { version: 0, hash: null, enabled: false };
    if (fs.existsSync(this.file)) {
      try {
        this.meta = JSON.parse(fs.readFileSync(this.file, "utf8"));
      } catch {
        throw Error("同步状态无法读取，原数据已保留");
      }
    }
    this.phase = "idle";
    this.message = "";
    this.conflict = null;
    this.busy = false;
  }
  save() {
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.meta), {
      mode: 0o600,
    });
    fs.renameSync(this.file + ".tmp", this.file);
  }
  status() {
    const pending =
      this.phase === "synced" &&
      hash(cloudDocument(this.store.state)) !== this.meta.hash;
    return {
      enabled: this.meta.enabled,
      phase: pending ? "pending" : this.phase,
      message: pending ? "本机有新修改，等待同步" : this.message,
      lastSync: this.meta.lastSync || null,
      conflict: this.conflict
        ? {
            local: cloudSummary(cloudDocument(this.store.state)),
            remote: cloudSummary(this.conflict.document),
          }
        : null,
    };
  }
  configure(enabled) {
    this.meta.enabled = !!enabled;
    this.save();
    if (enabled) return this.run();
    this.phase = "idle";
    this.message = "同步已暂停，本机数据继续保存";
    this.changed();
    return this.status();
  }
  stop() {
    this.stopped = true;
    clearInterval(this.interval);
    clearTimeout(this.debounce);
  }
  changedLocal() {
    if (
      !this.meta.enabled ||
      this.stopped ||
      this.debounce ||
      this.phase === "conflict"
    )
      return;
    if (hash(cloudDocument(this.store.state)) === this.meta.hash) return;
    this.debounce = setTimeout(() => {
      this.debounce = null;
      this.run().catch(() => {});
    }, 20000);
    this.debounce.unref?.();
  }
  start() {
    clearInterval(this.interval);
    this.stopped = false;
    this.interval = setInterval(() => {
      if (this.meta.enabled) this.run().catch(() => {});
    }, 5 * 60000);
    this.interval.unref?.();
  }
  async run(resolution) {
    if (this.busy || this.stopped || !this.meta.enabled) return this.status();
    this.busy = true;
    this.phase = "syncing";
    this.changed();
    try {
      if ((await this.provider.current()).id !== this.user.id)
        throw Error("登录账号与本地空间不一致，请重新登录");
      const remote = await this.provider.request({ action: "pull" });
      if (this.stopped || !this.meta.enabled) return this.status();
      if (!Number.isSafeInteger(remote.version) || remote.version < 0)
        throw Error("云端版本无效");
      const local = validateCloudDocument(cloudDocument(this.store.state)),
        localHash = hash(local);
      const doc = remote.document
        ? validateCloudDocument(remote.document)
        : null;
      const remoteHash = doc ? hash(doc) : null;
      if (doc && remoteHash === localHash) {
        this.settle(remote.version, localHash);
        return this.status();
      }
      const localChanged = this.meta.hash !== localHash;
      if (
        doc &&
        remote.version !== this.meta.version &&
        localChanged &&
        !resolution
      ) {
        this.conflict = { document: doc, version: remote.version };
        this.phase = "conflict";
        this.message = "两份数据都有修改，请选择保留哪一份。";
        return this.status();
      }
      if (
        resolution &&
        (!this.conflict || remote.version !== this.conflict.version)
      ) {
        this.conflict = doc ? { document: doc, version: remote.version } : null;
        this.phase = "conflict";
        this.message = "另一台设备刚刚更新，请重新核对。";
        return this.status();
      }
      if (
        doc &&
        ((remote.version !== this.meta.version && !localChanged) ||
          resolution === "remote")
      ) {
        this.backup(local, doc);
        this.store.commit({ ...this.store.state, ...doc });
        this.settle(remote.version, remoteHash);
      } else {
        if (resolution === "local" && doc) this.backup(local, doc);
        if (localChanged || !doc || resolution === "local") {
          const response = await this.provider.request({
            action: "push",
            version: remote.version,
            document: local,
          });
          if (this.stopped) return this.status();
          if (response.conflict) {
            this.phase = "conflict";
            this.message = "云端刚有新修改，请再次同步后核对。";
            this.conflict = null;
            return this.status();
          }
          if (
            !Number.isSafeInteger(response.version) ||
            response.version !== remote.version + 1
          )
            throw Error("云端未确认保存，请重试");
          this.settle(response.version, localHash);
        } else this.settle(remote.version, localHash);
      }
    } catch (e) {
      this.phase = "error";
      this.message =
        e.code === "UNAUTHENTICATED"
          ? "登录已过期，请重新登录"
          : e.message?.includes("空间")
            ? e.message
            : "同步未完成，数据仍保存在本机。请检查网络后重试。";
    } finally {
      this.busy = false;
      this.changed();
    }
    return this.status();
  }
  backup(local, remote) {
    const dir = path.join(this.directory, "sync-backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    for (const [name, document] of Object.entries({ local, remote }))
      fs.writeFileSync(
        path.join(dir, `${stamp}-${name}.json`),
        JSON.stringify(document),
        { mode: 0o600 },
      );
    this.store.backup();
  }
  settle(version, digest) {
    this.meta = { ...this.meta, version, hash: digest, lastSync: Date.now() };
    this.save();
    this.conflict = null;
    this.phase = "synced";
    this.message = "账号、任务、日程和专注记录已同步";
  }
}
