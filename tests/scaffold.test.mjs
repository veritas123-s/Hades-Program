import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
test("小组件脚手架生成独立扩展，拒绝覆盖与目录越界", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-scaffold-"));
  for (const relative of [
    "scripts/scaffold-widget.mjs",
    "src/platform/model.mjs",
    "src/themes/catalog.mjs",
    "src/themes/custom.mjs",
  ]) {
    const target = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, relative), target);
  }
  fs.mkdirSync(path.join(fixture, "src/extensions/widgets"), {
    recursive: true,
  });
  const script = path.join(fixture, "scripts/scaffold-widget.mjs");
  const run = (id) =>
    execFileSync(
      process.execPath,
      [script, "--id", id, "--title", "合成阅读卡片"],
      { encoding: "utf8", stdio: "pipe" },
    );
  assert.match(run("reading-card"), /已创建/);
  const file = path.join(
    fixture,
    "src/extensions/widgets/reading-card.widget.jsx",
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /defineWidget/);
  assert.match(text, /actions.configure/);
  assert.match(text, /合成阅读卡片/);
  assert.throws(() => run("reading-card"));
  assert.equal(fs.readFileSync(file, "utf8"), text);
  assert.throws(() => run("../escape"));
  assert.equal(
    fs.existsSync(path.join(fixture, "src/extensions/escape.widget.jsx")),
    false,
  );
});
