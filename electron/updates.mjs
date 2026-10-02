import fs from "node:fs";
import path from "node:path";
import {
  RELEASE_FEED,
  validateRelease,
  newerVersion,
} from "../src/releases.mjs";
export class Updates {
  constructor({
    directory,
    version,
    provider,
    fetcher = fetch,
    changed = () => {},
    open = () => {},
    clock = () => Date.now(),
    installer,
  }) {
    Object.assign(this, {
      version,
      provider,
      fetcher,
      changed,
      open,
      clock,
      installer,
    });
    this.file = path.join(directory, "medstack-updates.json");
    this.data = { dismissed: [], release: null, checkedAt: null };
    this.busy = false;
    this.error = "";
    try {
      const d = JSON.parse(fs.readFileSync(this.file));
      this.data = {
        dismissed: Array.isArray(d.dismissed)
          ? d.dismissed.filter((x) => typeof x === "string").slice(-100)
          : [],
        release: d.release ? validateRelease(d.release) : null,
        checkedAt: d.checkedAt,
      };
    } catch {}
  }
  status() {
    const release = this.data.release;
    return {
      installed: this.version,
      release,
      available: !!release && newerVersion(release.version, this.version),
      dismissed: !!release && this.data.dismissed.includes(release.version),
      checkedAt: this.data.checkedAt,
      busy: this.busy,
      error: this.error,
      installation: this.installer?.status(),
    };
  }
  save(data) {
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(data));
    fs.renameSync(this.file + ".tmp", this.file);
    this.data = data;
    this.changed();
  }
  async read(url) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 8000);
    try {
      return await Promise.race([
        (async () => {
          const response = await this.fetcher(url, {
            signal: controller.signal,
            redirect: "error",
            credentials: "omit",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw Error("更新源暂不可用");
          let text = "",
            size = 0;
          const reader = response.body?.getReader();
          if (!reader) throw Error("更新源返回空内容");
          const decoder = new TextDecoder("utf-8", { fatal: true });
          try {
            while (true) {
              const { done, value } = await reader.read();
              controller.signal.throwIfAborted();
              if (done) break;
              size += value.length;
              if (size > 32768) {
                await reader.cancel();
                throw Error("公告过大");
              }
              text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
          } finally {
            reader.releaseLock();
          }
          const d = JSON.parse(text);
          return d.release === null ? null : validateRelease(d.release || d);
        })(),
        new Promise((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () => reject(Error("检查更新超时")),
            { once: true },
          ),
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async check() {
    if (this.busy) return this.status();
    this.busy = true;
    this.error = "";
    this.changed();
    try {
      let release;
      try {
        release = await this.read(
          this.provider.origin + "/api/releases/latest",
        );
      } catch {
        release = await this.read(RELEASE_FEED);
      }
      if (release && Date.parse(release.publishedAt) > this.clock() + 300000)
        throw Error("公告尚未发布");
      if (
        release &&
        this.data.release &&
        newerVersion(this.data.release.version, release.version)
      )
        throw Error("更新源版本回退");
      this.save({
        ...this.data,
        release: release || this.data.release,
        checkedAt: this.clock(),
      });
    } catch {
      this.error = "暂时无法检查更新，已保留上次公告";
    } finally {
      this.busy = false;
      this.changed();
    }
    return this.status();
  }
  dismiss() {
    if (this.data.release)
      this.save({
        ...this.data,
        dismissed: [
          ...new Set([...this.data.dismissed, this.data.release.version]),
        ].slice(-100),
      });
    return this.status();
  }
  download(platform = "windows") {
    const release = this.data.release;
    if (!release) throw Error("暂无可下载版本");
    const item = validateRelease(release).downloads[platform];
    if (!item) throw Error("此平台的安装包尚未发布");
    return this.open(item.url);
  }
  async install() {
    if (!this.installer) throw Error("当前版本不支持一键更新");
    if (!this.status().available) throw Error("当前已是最新版本");
    return this.installer.install(this.data.release);
  }
  async email(body) {
    try {
      return await this.provider.call("/api/releases/preferences", body, {
        authenticated: true,
      });
    } catch (e) {
      if (e.code === "NOT_FOUND")
        throw Error("服务器尚未开通邮件订阅，请稍后重试");
      throw e;
    }
  }
}
