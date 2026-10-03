import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { updateWorker } from "../electron/update-installer.mjs";
if (process.platform !== "win32") throw Error("Windows worker test required");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-worker-test-"));
const source = path.join(root, "fixture.cs"),
  compiler = path.join(root, "compile.ps1"),
  binary = path.join(root, "fixture.exe");
fs.writeFileSync(
  source,
  `using System;using System.IO;using System.Reflection;
[assembly: AssemblyFileVersion("5.3.0.0")]
[assembly: AssemblyInformationalVersion("5.3.0")]
class Fixture {static int Main(string[] args){var self=Assembly.GetExecutingAssembly().Location;
if(args.Length==0){File.WriteAllText(Path.Combine(Path.GetDirectoryName(self),"test-launched.txt"),"synthetic");return 0;}
var all=String.Join(" ",args);var i=all.IndexOf("/D=");if(i<0)return 2;var dir=all.Substring(i+3).Trim('"');
Directory.CreateDirectory(Path.Combine(dir,"resources"));File.WriteAllText(Path.Combine(dir,"resources","version.txt"),"5.3.0");
return File.Exists(Path.Combine(Path.GetDirectoryName(self),"fail-install"))?1:0;}}
`,
);
fs.writeFileSync(
  compiler,
  "param($source,$output)\nAdd-Type -TypeDefinition (Get-Content -LiteralPath $source -Raw -Encoding UTF8) -OutputType WindowsApplication -OutputAssembly $output\n",
);
const shell = path.join(
  process.env.WINDIR,
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
execFileSync(
  shell,
  [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    compiler,
    source,
    binary,
  ],
  { windowsHide: true },
);
const sha256 = createHash("sha256")
    .update(fs.readFileSync(binary))
    .digest("hex"),
  results = [];
for (const failure of [false, true]) {
  const fixture = path.join(
      root,
      failure ? "failed installation" : "successful installation",
    ),
    profile = path.join(fixture, "profile"),
    program = path.join(fixture, "program with spaces");
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(path.join(program, "resources"), { recursive: true });
  const executable = path.join(program, "Medstack.exe"),
    installer = path.join(fixture, "install.exe");
  fs.copyFileSync(binary, executable);
  fs.copyFileSync(binary, installer);
  fs.writeFileSync(path.join(program, "resources/version.txt"), "old-version");
  const data = path.join(profile, "veritas-data.json"),
    raw = JSON.stringify({
      logs: [{ duration: 4000000 }],
      tasks: [{ title: "合成任务" }],
    });
  fs.writeFileSync(data, raw);
  if (failure)
    fs.writeFileSync(path.join(fixture, "fail-install"), "synthetic");
  const backup = path.join(profile, "upgrade-backups/test"),
    worker = path.join(fixture, "worker.ps1");
  const script = updateWorker({
    pid: 2147483000,
    executable,
    installer,
    sha256,
    directory: profile,
    backup,
    version: "5.3.0",
  });
  fs.writeFileSync(
    worker,
    "\ufeff" +
      script.replace(
        "} catch {",
        "} catch { $_.Exception.Message | Set-Content -LiteralPath '" +
          path.join(fixture, "synthetic-error.txt").replaceAll("'", "''") +
          "' -Encoding UTF8;",
      ),
  );
  execFileSync(
    shell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      worker,
    ],
    { windowsHide: true, timeout: 30000 },
  );
  const receipt = JSON.parse(
    fs
      .readFileSync(path.join(profile, "medstack-update-result.json"), "utf8")
      .replace(/^\ufeff/, ""),
  );
  assert.equal(
    receipt.ok,
    !failure,
    fs.existsSync(path.join(fixture, "synthetic-error.txt"))
      ? fs.readFileSync(path.join(fixture, "synthetic-error.txt"), "utf8")
      : "",
  );
  assert.equal(fs.readFileSync(data, "utf8"), raw);
  assert.equal(
    fs.readFileSync(path.join(backup, "veritas-data.json"), "utf8"),
    raw,
  );
  assert.equal(
    fs.readFileSync(
      path.join(backup, "previous-program/resources/version.txt"),
      "utf8",
    ),
    "old-version",
  );
  assert.equal(
    fs.readFileSync(path.join(program, "resources/version.txt"), "utf8"),
    failure ? "old-version" : "5.3.0",
  );
  results.push({ failure, passed: true });
}
fs.writeFileSync(
  "test-results/update-worker-isolated.json",
  JSON.stringify(
    { passed: true, synthetic: true, realInstaller: false, results },
    null,
    2,
  ),
);
console.log(
  "PASS Windows installation worker, path with spaces, data/program backups, failed-install rollback; synthetic executable only",
);
