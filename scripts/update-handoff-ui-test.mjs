// Isolated packaged handoff with a synthetic Windows installer, never the real profile.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { launchAuthenticated } from "./account-test-fixture.mjs";
const packaged = path.resolve(process.argv[2]);
console.log("Preparing isolated package copy");
const root = fs.mkdtempSync(path.resolve(".cache/medstack-real-handoff-"));
const program = path.join(root, "program with spaces");
const directory = path.join(root, "profile");
function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}
copyTree(path.dirname(packaged), program);
console.log("Compiling synthetic installer");
fs.mkdirSync(directory);
const fixture = path.join(root, "synthetic-install.exe");
const compile = path.join(root, "compile.ps1");
const source = path.join(root, "fixture.cs");
fs.writeFileSync(
  source,
  `using System;using System.IO;using System.Reflection;
[assembly:AssemblyFileVersion("6.0.3.0")]
[assembly:AssemblyInformationalVersion("6.0.3")]
class Fixture {static int Main(string[] args){string self=Assembly.GetExecutingAssembly().Location;
if(args.Length==0){File.WriteAllText(Path.Combine(Path.GetDirectoryName(self),"relaunch-confirmed.txt"),"synthetic");return 0;}
string all=String.Join(" ",args);int i=all.IndexOf("/D=");if(i<0)return 2;string dir=all.Substring(i+3).Trim('"');
File.Copy(self,Path.Combine(dir,"Medstack.exe"),true);return 0;}}
`,
);
fs.writeFileSync(
  compile,
  "param($source,$output)\nAdd-Type -TypeDefinition (Get-Content -LiteralPath $source -Raw -Encoding UTF8) -OutputType WindowsApplication -OutputAssembly $output\n",
);
const shell = path.join(
  process.env.WINDIR,
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
execFileSync(
  shell,
  [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    compile,
    source,
    fixture,
  ],
  { windowsHide: true },
);
const payload = Buffer.concat([fs.readFileSync(fixture), Buffer.alloc(150000)]);
const sha256 = createHash("sha256").update(payload).digest("hex");
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: directory };
delete env.ELECTRON_RUN_AS_NODE;
const app = await launchAuthenticated({
  executablePath: path.join(program, "Medstack.exe"),
  args: [],
  env,
});
console.log("Isolated packaged app ready");
let closed = false;
app.on("close", () => {
  closed = true;
});
try {
  await app.evaluate(
    ({ net }, { payload, sha256 }) => {
      const original = net.fetch.bind(net);
      net.fetch = async (url, options) =>
        new URL(url).pathname === "/api/releases/latest"
          ? Response.json({
              schema: 1,
              version: "6.0.3",
              publishedAt: "2026-01-01T00:00:00Z",
              title: "合成更新",
              notes: ["隔离测试"],
              downloads: {
                windows: {
                  url: "https://github.com/veritas123-s/Medstack-Program/releases/download/v6.0.3/Medstack-Setup-6.0.3-x64.exe",
                  sha256,
                },
              },
            })
          : original(url, options);
      const fetchOriginal = global.fetch;
      global.fetch = async (url, options) =>
        String(url).includes("/download/v6.0.3/")
          ? new Response(Buffer.from(payload, "base64"))
          : fetchOriginal(url, options);
    },
    { payload: payload.toString("base64"), sha256 },
  );
  const page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  const initial = await page.evaluate(() => window.veritas.call("state"));
  const applicationPid = await app.evaluate(() => process.pid);
  await page.evaluate(() => window.veritas.call("updates.check"));
  await page
    .getByRole("button", { name: "一键更新", exact: true })
    .first()
    .click();
  const receiptFile = path.join(directory, "medstack-update-result.json");
  const deadline = Date.now() + 45000;
  while (
    Date.now() < deadline &&
    (!fs.existsSync(receiptFile) ||
      !fs.existsSync(path.join(program, "relaunch-confirmed.txt")))
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  if (!fs.existsSync(receiptFile) && !closed) {
    const state = await page.evaluate(() => window.veritas.call("state"));
    console.log(
      JSON.stringify({ closed, installation: state.updates.installation }),
    );
  }
  assert.ok(
    fs.existsSync(receiptFile),
    "Update worker disappeared after application quit",
  );
  const receipt = JSON.parse(
    fs.readFileSync(receiptFile, "utf8").replace(/^\ufeff/, ""),
  );
  assert.equal(receipt.ok, true, JSON.stringify(receipt));
  assert.throws(() => process.kill(applicationPid, 0), { code: "ESRCH" });
  closed = true;
  assert.ok(
    fs.existsSync(path.join(program, "relaunch-confirmed.txt")),
    "Application not relaunched",
  );
  const ready = JSON.parse(
    fs
      .readFileSync(
        path.join(directory, "updates/6.0.3/worker-ready.json"),
        "utf8",
      )
      .replace(/^\ufeff/, ""),
  );
  assert.ok(ready.pid > 0);
  const data = JSON.parse(
    fs.readFileSync(path.join(directory, "veritas-data.json")),
  );
  assert.ok(data.tasks && data.logs);
  const rootData = path.join(directory, "veritas-data.json");
  assert.equal(
    fs.readFileSync(rootData, "utf8"),
    fs.readFileSync(path.join(receipt.backup, "veritas-data.json"), "utf8"),
  );
  fs.writeFileSync(
    "test-results/update-handoff-ui.json",
    JSON.stringify(
      {
        passed: true,
        synthetic: true,
        packaged: true,
        realInstaller: false,
        confirmedWorker: true,
        closedAfterConfirmation: true,
        dataPreserved: true,
        backupVerified: true,
        relaunched: true,
        installedBefore: initial.updates.installed,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS packaged update handoff, worker confirmation, app quit, installer launch, backup preservation and relaunch; isolated synthetic installer",
  );
} finally {
  if (!closed) await app.close();
}
