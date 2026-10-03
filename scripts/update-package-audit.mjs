import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import * as asar from "@electron/asar";
const pkg = JSON.parse(fs.readFileSync("package.json"));
const directory = pkg.build.directories.output;
const archive = path.join(directory, "win-unpacked/resources/app.asar");
for (const file of [
  "electron/update-installer.mjs",
  "electron/main.cjs",
  "electron/news-service.mjs",
  "src/news-preferences.mjs",
  "docs/licenses/SJTU-AGENT-MIT.txt",
])
  assert.deepEqual(
    asar.extractFile(archive, path.normalize(file)),
    fs.readFileSync(file),
    `Stale or missing ${file}`,
  );
assert.deepEqual(
  fs.readFileSync(
    path.join(directory, "win-unpacked/licenses/SJTU-AGENT-MIT.txt"),
  ),
  fs.readFileSync("docs/licenses/SJTU-AGENT-MIT.txt"),
);
assert.deepEqual(
  fs.readFileSync("docs/licenses/SJTU-AGENT-MIT.txt"),
  fs.readFileSync(".cache/sjtu-agent-upstream/LICENSE"),
);
const ui = fs
  .readdirSync("dist/assets")
  .find((x) => /^SettingsPage-.*\.js$/.test(x));
const bundled = asar
  .extractFile(archive, path.normalize("dist/assets/" + ui))
  .toString("utf8");
assert.ok(
  bundled.includes("鸣谢 SJTU Agent") &&
    bundled.includes("kuan-er") &&
    bundled.includes("MIT License"),
);
fs.writeFileSync(
  "test-results/update-package-audit.json",
  JSON.stringify(
    {
      passed: true,
      version: pkg.version,
      sourceMatches: true,
      licenseOriginalUnchanged: true,
      licenseInArchive: true,
      licenseBesideExecutable: true,
      developerInAbout: true,
    },
    null,
    2,
  ),
);
console.log(
  "PASS actual package source matching, original MIT license, installed license and developer attribution",
);
