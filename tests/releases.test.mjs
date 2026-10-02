import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateRelease, newerVersion } from "../src/releases.mjs";
import { Updates } from "../electron/updates.mjs";
import { APP_VERSION } from "../src/version.mjs";
test("界面、安装目录、桌面和安卓版本保持一致", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json"));
  assert.equal(APP_VERSION, pkg.version);
  assert.ok(pkg.build.directories.output.endsWith(pkg.version));
  assert.ok(
    fs
      .readFileSync("android/app/build.gradle.kts", "utf8")
      .includes(`versionName = "${pkg.version}"`),
  );
});
const release = (version = "5.2.0") => ({
  schema: 1,
  version,
  publishedAt: "2026-01-01T00:00:00Z",
  title: "医栈通更新",
  notes: ["更新通知中心"],
  downloads: {
    windows: {
      url: `https://github.com/veritas123-s/Medstack-Program/releases/download/v${version}/Medstack-Setup-${version}-x64.exe`,
      sha256: "a".repeat(64),
    },
  },
});
test("更新公告严格校验版本、下载目标与校验值，数字版本比较", () => {
  assert.equal(newerVersion("5.10.0", "5.2.0"), true);
  assert.equal(newerVersion("5.1.0", "5.1.0"), false);
  for (const version of ["5.1", "5.01.0", "5.1.0-beta", "javascript:alert(1)"])
    assert.throws(() => validateRelease(release(version)));
  for (const url of [
    "https://evil.invalid/install.exe",
    "https://github.com/other/repo/releases/download/v5.2.0/install.exe",
  ]) {
    const r = release();
    r.downloads.windows.url = url;
    assert.throws(() => validateRelease(r));
  }
  const r = release();
  r.downloads.windows.sha256 = "bad";
  assert.throws(() => validateRelease(r));
});
test("公告检查不带令牌，离线保留、版本去重、下一版本再提醒与拒绝回退", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-updates-"));
  let current = release(),
    offline = false;
  const opened = [];
  const options = {
    directory,
    version: "5.1.0",
    provider: {
      origin: "https://accounts.synthetic.invalid",
      token: "never-share",
    },
    open: (url) => opened.push(url),
    fetcher: async (url, request) => {
      assert.equal(request.headers.Authorization, undefined);
      if (offline) throw Error("offline");
      return Response.json({ release: current });
    },
  };
  try {
    let service = new Updates(options);
    assert.equal((await service.check()).available, true);
    service.dismiss();
    service = new Updates(options);
    assert.equal(service.status().dismissed, true);
    service.download();
    assert.equal(opened.length, 1);
    assert.throws(() => service.download("../malicious"));
    offline = true;
    assert.ok((await service.check()).error);
    assert.equal(service.status().release.version, "5.2.0");
    offline = false;
    current = release("5.3.0");
    assert.equal((await service.check()).dismissed, false);
    current = release("5.1.0");
    await service.check();
    assert.equal(service.status().release.version, "5.3.0");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
