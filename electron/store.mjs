import fs from "node:fs";
import path from "node:path";
import { initialState, validateState, recoverTimer } from "../src/domain.mjs";

import { ensureLists } from "../src/domain/content.mjs";
import { CURRENT_DATA_VERSION } from "../src/domain/migrations.mjs";
export class Store {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, "veritas-data.json");
    this.state = initialState();
    if (fs.existsSync(this.file)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
        this.state = validateState(raw);
        if (raw.schemaVersion < CURRENT_DATA_VERSION)
          fs.copyFileSync(
            this.file,
            path.join(
              directory,
              `veritas-data.pre-schema${raw.schemaVersion}-${Date.now()}.json`,
            ),
          );
      } catch (error) {
        if (error.code === "NEWER_DATA_VERSION") throw error;
        const damaged = `${this.file}.damaged-${Date.now()}`;
        fs.copyFileSync(this.file, damaged);
        try {
          this.state = validateState(
            JSON.parse(fs.readFileSync(`${this.file}.bak`, "utf8")),
          );
          this.state.lastNotice =
            "主数据文件异常，已从自动备份恢复。原文件已保留。";
          this.skipBackupOnce = true;
        } catch {
          throw new Error(
            "数据文件与自动备份均无法读取。已保留原文件，请先修复数据，避免覆盖。",
          );
        }
      }
    }
    recoverTimer(this.state);
    this.commit(this.state);
  }
  commit(next) {
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(next), {
      encoding: "utf8",
      mode: 0o600,
    });
    if (fs.existsSync(this.file) && !this.skipBackupOnce)
      fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(temp, this.file);
    this.state = next;
    this.skipBackupOnce = false;
    this.onCommit?.();
  }
  change(action) {
    const next = structuredClone(this.state);
    const result = action(next);
    ensureLists(next);
    this.commit(next);
    return result;
  }
  backup() {
    const target = path.join(
      path.dirname(this.file),
      `backup-${Date.now()}.json`,
    );
    fs.copyFileSync(this.file, target);
    return target;
  }
}
