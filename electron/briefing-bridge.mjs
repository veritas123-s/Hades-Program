import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildFeed, briefingPreview } from "../src/briefing.mjs";

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(file + ".tmp", file);
}
export class BriefingBridge {
  constructor(directory) {
    this.directory = directory;
    this.configFile = path.join(directory, "bridge-config.json");
    this.config = { sharedRoot: "", cloudDirectory: "", enabled: true };
    this.lastSignature = "";
    this.status = {
      local: "waiting",
      cloud: "not_configured",
      message: "本机快报接口正在准备。",
      updatedAt: null,
    };
    if (fs.existsSync(this.configFile)) {
      try {
        this.config = {
          ...this.config,
          ...JSON.parse(fs.readFileSync(this.configFile, "utf8")),
        };
      } catch {
        this.status.message = "快报连接配置损坏，请重新选择目录。";
      }
    }
  }
  configure(patch) {
    this.config = { ...this.config, ...patch };
    writeAtomic(this.configFile, this.config);
    this.lastSignature = "";
  }
  registry() {
    if (!this.config.sharedRoot) return { items: [], study_rule: null };
    const file = path.join(
      this.config.sharedRoot,
      "reminders",
      "reminders.json",
    );
    if (!fs.existsSync(file)) return { items: [], study_rule: null };
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      items: (data.items || []).map((x) => ({
        id: x.id,
        title: x.title || x.message,
        message: x.message,
        enabled: x.enabled !== false,
        schedule: x.schedule || [],
      })),
      study_rule: data.study_rule
        ? {
            enabled: data.study_rule.enabled,
            notification_time: data.study_rule.notification_time,
            deployment_status: data.study_rule.deployment_status,
          }
        : null,
    };
  }
  export(state, force = false) {
    if (!this.config.enabled) return;
    const signature = createHash("sha256")
      .update(JSON.stringify([state.tasks, state.courses, state.courseRanges]))
      .digest("hex");
    if (
      !force &&
      this.lastSignature === signature &&
      Date.now() - (this.status.updatedAt || 0) < 3600000
    )
      return;
    const feed = buildFeed(state),
      targets = [path.join(this.directory, "briefing", "veritas-feed.json")];
    if (this.config.sharedRoot)
      targets.push(
        path.join(
          this.config.sharedRoot,
          "integrations",
          "veritas",
          "veritas-feed.json",
        ),
      );
    if (this.config.cloudDirectory)
      targets.push(path.join(this.config.cloudDirectory, "veritas-feed.json"));
    for (const file of targets) writeAtomic(file, feed);
    this.sync?.enqueue(feed);
    this.lastSignature = signature;
    this.status = {
      local: "ready",
      cloud: this.config.cloudDeployment
        ? "snapshot_deployed"
        : "pending_deployment",
      message: this.config.cloudDeployment
        ? "云端已部署一次快照；本机后续修改尚需上传，动态同步通道未连接。"
        : "本机快报数据已更新；云端仍需部署或连接动态数据源。",
      updatedAt: Date.now(),
    };
    return feed;
  }
  snapshot(state, date) {
    const feed = buildFeed(state);
    let registry;
    try {
      registry = this.registry();
    } catch {
      registry = { items: [], error: "共享备忘台账无法读取，请检查文件。" };
    }
    return {
      ...this.status,
      config: this.config,
      preview: briefingPreview(feed, date),
      registry,
      sync: this.sync?.status(),
      counts: {
        tasks: feed.tasks.length,
        verifiedDates: feed.timetable.verified_dates.length,
      },
    };
  }
}
