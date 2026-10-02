import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  UpdateInstaller,
  installerURL,
  updateWorker,
} from "../electron/update-installer.mjs";
const payload = Buffer.alloc(150000, 65);
const release = {
  schema: 1,
  version: "5.3.0",
  publishedAt: "2026-01-01T00:00:00Z",
  title: "合成更新",
  notes: ["合成"],
  downloads: {
    windows: {
      url: "https://github.com/veritas123-s/Medstack-Program/releases/download/v5.3.0/Medstack-Setup-5.3.0-x64.exe",
      sha256: createHash("sha256").update(payload).digest("hex"),
    },
  },
};
test("一键更新只接受指定仓库、更高版本与正确哈希；失败不退出", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-updater-test-"),
  );
  let exits = 0;
  const updater = new UpdateInstaller({
    directory,
    version: "5.2.2",
    executable: path.join(directory, "program", "Medstack.exe"),
    packaged: true,
    fetcher: async () => new Response(payload),
    exit: async () => {
      exits++;
    },
  });
  try {
    if (!updater.state.supported) return;
    await assert.rejects(
      updater.install({
        ...release,
        downloads: {
          windows: { ...release.downloads.windows, sha256: "0".repeat(64) },
        },
      }),
      /校验/,
    );
    assert.equal(exits, 0);
    assert.equal(updater.status().phase, "error");
    assert.throws(() =>
      installerURL(
        "https://release-assets.githubusercontent.com.evil.invalid/x",
      ),
    );
    await assert.rejects(updater.install({ ...release, version: "5.2.2" }));
    assert.equal(exits, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("校验后才调用保存退出与独立安装器，工作脚本使用固定参数且保留备份", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-updater-test-"),
  );
  const sequence = [];
  const updater = new UpdateInstaller({
    directory,
    version: "5.2.2",
    executable: path.join(directory, "program", "Medstack.exe"),
    packaged: true,
    fetcher: async (_url, o) => {
      assert.equal(o.credentials, "omit");
      sequence.push("download");
      return new Response(payload);
    },
    exit: async (launch) => {
      sequence.push("persist");
      await launch();
      sequence.push("exit");
    },
    launch: (_shell, args, options) => {
      sequence.push("launch");
      assert.ok(args.includes("-NonInteractive"));
      assert.equal(options.windowsHide, true);
      const worker = fs.readFileSync(args.at(-1), "utf8");
      assert.match(worker, /Backup verification failed/);
      assert.match(worker, /\$backupVerified -and \$installerStarted/);
      assert.match(worker, /Personal data changed/);
      const child = new EventEmitter();
      child.unref = () => {};
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
  });
  try {
    if (!updater.state.supported) return;
    await updater.install(release);
    assert.deepEqual(sequence, ["download", "persist", "launch", "exit"]);
    assert.equal(updater.status().phase, "installing");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("安装脚本拒绝非法PID、校验和与应用名称", () => {
  assert.throws(() =>
    updateWorker({ pid: 0, sha256: "a".repeat(64), version: "5.3.0" }),
  );
});
