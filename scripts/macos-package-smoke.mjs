import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { _electron as electron } from "playwright";
import {
  launchAuthenticated,
  clearSyntheticSession,
} from "./account-test-fixture.mjs";

if (process.platform !== "darwin")
  throw Error("macOS package verification requires macOS");
const pkg = JSON.parse(fs.readFileSync("package.json"));
const arch = process.env.MEDSTACK_EXPECTED_ARCH || process.arch;
assert.equal(
  process.arch,
  arch,
  "Verification must run on the native target architecture",
);
const dmg = path.resolve(
  pkg.build.directories.output,
  `Medstack-${pkg.version}-macOS-${arch}.dmg`,
);
const output = path.resolve("test-results/macos");
fs.mkdirSync(output, { recursive: true });
const mount = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-dmg-"));
const installed = path.join(
  process.env.RUNNER_TEMP || os.tmpdir(),
  "medstack-installed",
);
const target = path.join(installed, "Medstack.app");
if (fs.existsSync(target))
  throw Error("Synthetic install directory already exists");
execFileSync("hdiutil", ["verify", dmg], { stdio: "inherit" });
execFileSync(
  "hdiutil",
  ["attach", dmg, "-readonly", "-nobrowse", "-mountpoint", mount],
  { stdio: "inherit" },
);
try {
  assert.ok(
    fs.existsSync(path.join(mount, "Applications")),
    "DMG must offer the Applications shortcut",
  );
  fs.mkdirSync(installed, { recursive: true });
  fs.cpSync(path.join(mount, "Medstack.app"), target, {
    recursive: true,
    dereference: false,
  });
} finally {
  execFileSync("hdiutil", ["detach", mount], { stdio: "inherit" });
}
execFileSync("codesign", ["--verify", "--deep", "--strict", target], {
  stdio: "inherit",
});
const signature = execFileSync("codesign", ["-dv", "--verbose=4", target], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const executable = path.join(target, "Contents/MacOS/Medstack");
assert.ok(
  execFileSync("lipo", ["-archs", executable], { encoding: "utf8" }).includes(
    arch,
  ),
);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-mac-smoke-"));
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const options = { executablePath: executable, args: [], env };
let app;
const checks = [];
try {
  app = await electron.launch(options);
  let page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "登录 医栈通", exact: true })
    .waitFor();
  const locked = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(locked.account.authenticated, false);
  assert.equal(locked.tasks.length, 0);
  await page.screenshot({ path: path.join(output, `login-${arch}.png`) });
  const native = await app.evaluate(({ app, Menu }) => ({
    arch: process.arch,
    roles: Menu.getApplicationMenu().items.flatMap(
      (menu) => menu.submenu?.items.map((item) => item.role) || [],
    ),
    name: app.getName(),
  }));
  assert.equal(native.arch, arch);
  for (const role of ["quit", "copy", "paste", "undo", "services"])
    assert.ok(native.roles.includes(role), role);
  const help = await page.evaluate(() =>
    window.veritas.call("help.read", { kind: "user" }),
  );
  assert.ok(help.text.includes("医栈通"));
  checks.push(
    "Native architecture, mounted DMG, deep code signature, login privacy gate, native menus and bundled help",
  );
  await app.close();
  app = await launchAuthenticated(options);
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  await app.evaluate(({ app }) => app.emit("activate"));
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    true,
  );
  const state = await page.evaluate(() => window.veritas.call("state"));
  assert.equal(state.account.authenticated, true);
  assert.equal(state.updates.platform, `macos_${arch}`);
  await page.screenshot({ path: path.join(output, `workspace-${arch}.png`) });
  checks.push(
    "Authenticated workspace, close/reopen from Dock, matching update architecture",
  );
  await clearSyntheticSession(app);
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(
      { version: pkg.version, arch, checks, notarized: false, signature },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
}
